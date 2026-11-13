import { Injectable } from '@nestjs/common';
import {
  EXPOSED_FILE_CHECKS,
  type ExposedFileCheck,
  type ExposedFilesOutput,
  type ExposedFilesParams,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextPrefix } from '../../core/http/read-limited.js';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import { exposedFindings, matchSignature } from './exposed-files.signatures.js';

const TIMEOUT_MS = 8000;
const MAX_BYTES = 64 * 1024;

type CheckDef = (typeof EXPOSED_FILE_CHECKS)[number];

@Injectable()
export class ExposedFilesService {
  constructor(
    private readonly http: HttpClientService,
    private readonly guard: TargetGuardService,
  ) {}

  async check({ target }: ExposedFilesParams): Promise<ExposedFilesOutput> {
    const origin = new URL(target).origin;
    // Fail fast with 403/404 for blocked or unresolvable targets instead of per-path errors.
    await this.guard.resolve(new URL(origin).hostname.replace(/^\[|\]$/g, ''));

    const checks = await mapConcurrent(EXPOSED_FILE_CHECKS, 4, (c) =>
      this.probe(origin, c),
    );
    return { origin, checks, findings: exposedFindings(checks) };
  }

  /** Checks one path; never throws, errors end up in `error`. */
  private async probe(
    origin: string,
    def: CheckDef,
  ): Promise<ExposedFileCheck> {
    const check: ExposedFileCheck = {
      path: def.path,
      title: def.title,
      severity: def.severity,
      url: origin + def.path,
      exposed: false,
    };
    try {
      const res = await this.http.target(check.url, {
        redirect: 'manual',
        timeoutMs: TIMEOUT_MS,
      });
      check.status = res.status;
      if (res.status !== 200) {
        await res.body?.cancel();
        return check;
      }
      const { text } = await readTextPrefix(res, MAX_BYTES);
      const match = matchSignature(def.path, text);
      check.exposed = match.exposed;
      if (match.exposed) check.evidence = match.evidence;
      else check.soft404 = true;
    } catch (err) {
      check.error = err instanceof Error ? err.message : String(err);
    }
    return check;
  }
}
