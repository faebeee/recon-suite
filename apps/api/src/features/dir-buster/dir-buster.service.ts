import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DIR_BUSTER_TIME_BUDGET_MS,
  MAX_DIR_BUSTER_REQUESTS,
  type DirBusterHit,
  type DirBusterOutput,
  type DirBusterParams,
  type DirBusterStop,
} from '@recon/shared';
import type { Response } from 'undici';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextPrefix } from '../../core/http/read-limited.js';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import {
  MAX_HITS,
  candidates,
  dirBusterFindings,
  extensionOf,
  isNotFound,
  isWildcard,
  matchesBaseline,
  scanBase,
  toHit,
  uniqueWords,
  withDirectoryResponse,
  type ProbeResponse,
} from './dir-buster.analysis.js';
import { WORDLISTS } from '../../core/wordlists/web-content.js';

const TIMEOUT_MS = 8000;
/** Enough for <title> and directory-index markers; the rest of the body is dropped. */
const MAX_BODY_BYTES = 16 * 1024;
/** This many 429 answers end the scan: the server is asking us to slow down. */
const RATE_LIMIT_STOP = 10;
/** Directories scanned per recursion level (in addition to the request budget). */
const MAX_DIRS_PER_LEVEL = 20;

interface ScanState {
  requests: number;
  errors: number;
  rateLimited: number;
  deadline: number;
  stopped?: DirBusterStop;
}

/** What `now()` and the random calibration segment come from (overridable in tests). */
export interface DirBusterClock {
  now: () => number;
  token: () => string;
}

const SYSTEM_CLOCK: DirBusterClock = {
  now: () => Date.now(),
  token: () => `rs${randomBytes(6).toString('hex')}`,
};

@Injectable()
export class DirBusterService {
  private clock: DirBusterClock = SYSTEM_CLOCK;

  constructor(
    private readonly http: HttpClientService,
    private readonly guard: TargetGuardService,
  ) {}

  /** Tests only: deterministic time and calibration token. */
  useClock(clock: DirBusterClock): this {
    this.clock = clock;
    return this;
  }

  async scan(p: DirBusterParams): Promise<DirBusterOutput> {
    const base = scanBase(p.target);
    // Fail fast with 403/404 for unresolvable targets instead of thousands of per-path errors.
    await this.guard.resolve(new URL(base).hostname.replace(/^\[|\]$/g, ''));

    const words = uniqueWords(WORDLISTS[p.wordlist], p.extraWords);
    const state: ScanState = {
      requests: 0,
      errors: 0,
      rateLimited: 0,
      deadline: this.clock.now() + DIR_BUSTER_TIME_BUDGET_MS,
    };
    const hits = new Map<string, DirBusterHit>();
    const wildcardDirs: string[] = [];

    let level = [base];
    for (let depth = 1; depth <= p.depth && level.length; depth++) {
      const next: string[] = [];
      for (const dir of level) {
        if (state.stopped) break;
        const found = await this.scanDir(dir, depth, words, p, state);
        if (found.wildcard) wildcardDirs.push(new URL(dir).pathname);
        for (const h of found.hits) {
          if (hits.has(h.path) || hits.size >= MAX_HITS) continue;
          hits.set(h.path, h);
          if (h.kind === 'directory' && next.length < MAX_DIRS_PER_LEVEL) {
            next.push(h.url);
          }
        }
      }
      level = next;
    }

    const list = [...hits.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    return {
      base,
      wordlist: p.wordlist,
      words: words.length,
      extensions: p.extensions,
      requests: state.requests,
      errors: state.errors,
      ...(state.stopped && { stopped: state.stopped }),
      wildcardDirs,
      hits: list,
      findings: dirBusterFindings(list),
    };
  }

  /** Calibrates one directory with random paths, then probes every candidate in it. */
  private async scanDir(
    dirUrl: string,
    depth: number,
    words: string[],
    p: DirBusterParams,
    state: ScanState,
  ): Promise<{ hits: DirBusterHit[]; wildcard: boolean }> {
    const token = this.clock.token();
    const baselines = new Map<string, ProbeResponse | undefined>();
    for (const ext of ['', ...p.extensions]) {
      const segment = ext ? `${token}.${ext}` : token;
      baselines.set(ext, await this.request(dirUrl + segment, state, true));
    }
    const wildcard = [...baselines.values()].some(isWildcard);

    const results = await mapConcurrent(
      candidates(words, p.extensions),
      p.threads,
      async (candidate) => {
        const ext = extensionOf(candidate, p.extensions);
        const res = await this.request(
          dirUrl + candidate,
          state,
          false,
          (s) =>
            // Read bodies only where they can matter: possible hits.
            !isNotFound(s),
        );
        if (!res) return null;
        const baselineSegment = ext ? `${token}.${ext}` : token;
        if (
          matchesBaseline(res, candidate, baselines.get(ext), baselineSegment)
        )
          return null;
        const hit = toHit(dirUrl, candidate, res, depth);
        // A directory found through its redirect to "/": one more request shows what the
        // directory itself answers (index page, listing, 403, ...).
        if (hit?.kind === 'directory' && !hit.listing && res.location) {
          const dir = await this.request(hit.url, state, true);
          if (dir) return withDirectoryResponse(hit, dir);
        }
        return hit;
      },
    );
    return {
      hits: results.filter((h): h is DirBusterHit => h !== null),
      wildcard,
    };
  }

  /**
   * One guarded GET without following redirects. Returns undefined once the scan stopped or
   * when the request failed (counted in `errors`). Calibration requests always read the body
   * size; probes only when `readBody(status)` says so.
   */
  private async request(
    url: string,
    state: ScanState,
    calibration: boolean,
    readBody: (status: number) => boolean = () => true,
  ): Promise<ProbeResponse | undefined> {
    if (state.stopped) return undefined;
    if (state.requests >= MAX_DIR_BUSTER_REQUESTS) {
      state.stopped = 'request-limit';
      return undefined;
    }
    if (this.clock.now() >= state.deadline) {
      state.stopped = 'time-limit';
      return undefined;
    }
    state.requests++;
    let res: Response;
    try {
      res = await this.http.target(url, {
        redirect: 'manual',
        timeoutMs: TIMEOUT_MS,
      });
    } catch {
      state.errors++;
      return undefined;
    }
    if (res.status === 429 && ++state.rateLimited >= RATE_LIMIT_STOP) {
      state.stopped = 'rate-limited';
    }
    const location = res.headers.get('location') ?? undefined;
    const declared = Number(res.headers.get('content-length') ?? NaN);
    const out: ProbeResponse = {
      status: res.status,
      ...(location && { location: resolve(location, url) }),
      ...(res.headers.get('content-type') && {
        contentType: res.headers.get('content-type')!.split(';')[0]!.trim(),
      }),
    };
    if (!calibration && !readBody(res.status)) {
      await res.body?.cancel();
      return out;
    }
    try {
      const { text, truncated } = await readTextPrefix(res, MAX_BODY_BYTES);
      out.body = text;
      const length = Number.isFinite(declared)
        ? declared
        : truncated
          ? undefined
          : Buffer.byteLength(text);
      if (length !== undefined) out.length = length;
    } catch {
      state.errors++;
      return undefined;
    }
    return out;
  }
}

function resolve(location: string, base: string): string {
  try {
    return new URL(location, base).href;
  } catch {
    return location;
  }
}
