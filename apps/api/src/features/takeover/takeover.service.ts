import { BadGatewayException, Injectable } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import {
  MAX_TAKEOVER_HOSTS,
  type TakeoverCandidate,
  type TakeoverOutput,
  type TakeoverParams,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import {
  readTextLimited,
  readTextPrefix,
} from '../../core/http/read-limited.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import { matchProvider } from './providers.js';
import {
  buildTakeoverFindings,
  classify,
  needsBody,
  parseCtNames,
  resolveChain,
  sortCandidates,
  type BodyResult,
  type TakeoverDns,
} from './takeover.analysis.js';

const RESOLVERS = ['1.1.1.1', '1.0.0.1'];
const CT_MAX_BYTES = 50 * 1024 * 1024;
const BODY_MAX_BYTES = 64 * 1024;
const CONCURRENCY = 8;

function publicDns(): TakeoverDns {
  const r = new Resolver({ timeout: 3000, tries: 2 });
  r.setServers(RESOLVERS);
  return {
    cname: (name) => r.resolveCname(name),
    async addresses(name) {
      const [v4, v6] = await Promise.allSettled([
        r.resolve4(name),
        r.resolve6(name),
      ]);
      const found = [v4, v6].flatMap((x) =>
        x.status === 'fulfilled' ? x.value : [],
      );
      if (found.length) return found;
      // Prefer NXDOMAIN over NODATA over other errors when reporting.
      const errs = [v4, v6].map(
        (x) => (x as PromiseRejectedResult).reason as NodeJS.ErrnoException,
      );
      throw (
        errs.find((e) => e.code === 'ENOTFOUND') ??
        errs.find((e) => e.code === 'ENODATA') ??
        errs[0]
      );
    },
  };
}

@Injectable()
export class TakeoverService {
  /** Replaceable in tests (no internet there). */
  dns: TakeoverDns = publicDns();

  constructor(private readonly http: HttpClientService) {}

  async check({
    target,
    source,
    hosts,
  }: TakeoverParams): Promise<TakeoverOutput> {
    const domain = target.toLowerCase().replace(/\.$/, '');
    const names = [domain, ...hosts.map((h) => h.toLowerCase())];
    if (source === 'ct') names.push(...(await this.fromCt(domain)));
    const list = [...new Set(names)].slice(0, MAX_TAKEOVER_HOSTS);

    const results = await mapConcurrent(list, CONCURRENCY, (host) =>
      this.examine(host),
    );
    const candidates = sortCandidates(
      results.filter((c): c is TakeoverCandidate => !!c),
    );
    return {
      domain,
      source,
      checked: list.length,
      candidates,
      findings: buildTakeoverFindings(candidates, list.length),
    };
  }

  /** Returns a candidate for hosts with a CNAME or provider match, else undefined. */
  private async examine(host: string): Promise<TakeoverCandidate | undefined> {
    const resolved = await resolveChain(host, this.dns);
    if (resolved.chain.length === 0) return undefined;
    const provider = matchProvider(resolved.chain);
    const body =
      !resolved.error && needsBody(provider, resolved.dangling)
        ? await this.fetchBody(host)
        : undefined;
    return classify(host, resolved, provider, body);
  }

  private async fetchBody(host: string): Promise<BodyResult> {
    try {
      const { res } = await this.http.targetFollow(`http://${host}/`, {
        timeoutMs: 8000,
        maxRedirects: 3,
      });
      return { text: (await readTextPrefix(res, BODY_MAX_BYTES)).text };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async fromCt(domain: string): Promise<string[]> {
    const url = new URL('https://crt.sh/');
    url.searchParams.set('q', `%.${domain}`);
    url.searchParams.set('output', 'json');
    let text: string;
    try {
      const res = await this.http.trusted(url.href, { timeoutMs: 45_000 });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`responded ${res.status}`);
      }
      text = await readTextLimited(res, CT_MAX_BYTES);
    } catch (err) {
      throw new BadGatewayException(
        `Could not load subdomains from crt.sh (${(err as Error).message}). Try again shortly or use source "list".`,
      );
    }
    try {
      const entries: unknown = text.trim() ? JSON.parse(text) : [];
      return Array.isArray(entries)
        ? parseCtNames(entries as { name_value?: string }[], domain)
        : [];
    } catch {
      throw new BadGatewayException('crt.sh returned an invalid response');
    }
  }
}
