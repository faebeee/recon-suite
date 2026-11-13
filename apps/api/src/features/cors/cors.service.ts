import { Injectable } from '@nestjs/common';
import type { CorsOutput, CorsParams, CorsTest } from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import {
  buildProbes,
  corsFindings,
  evaluateCors,
  readCorsHeaders,
  type CorsProbe,
} from './cors.analysis.js';

const TIMEOUT_MS = 8000;

@Injectable()
export class CorsService {
  constructor(private readonly http: HttpClientService) {}

  async check({ target }: CorsParams): Promise<CorsOutput> {
    // Resolve redirects once without an Origin; all probes hit the final URL.
    const { res, finalUrl } = await this.http.targetFollow(target, {
      maxRedirects: 5,
      timeoutMs: TIMEOUT_MS,
    });
    await res.body?.cancel();

    const tests = await mapConcurrent(buildProbes(finalUrl), 3, (p) =>
      this.probe(finalUrl, p),
    );
    return { url: finalUrl, tests, findings: corsFindings(tests) };
  }

  /** Runs one probe; never throws, errors end up in `error`. */
  private async probe(url: string, probe: CorsProbe): Promise<CorsTest> {
    const headers: Record<string, string> = {};
    if (probe.origin) headers.origin = probe.origin;
    if (probe.method === 'OPTIONS') {
      headers['access-control-request-method'] = 'PUT';
      headers['access-control-request-headers'] = 'authorization';
    }
    try {
      const res = await this.http.target(url, {
        method: probe.method,
        redirect: 'manual',
        headers,
        timeoutMs: TIMEOUT_MS,
      });
      await res.body?.cancel();
      const h = readCorsHeaders(res.status, res.headers);
      const { verdict, message } = evaluateCors(probe, h);
      return {
        id: probe.id,
        origin: probe.origin,
        method: probe.method,
        ...h,
        verdict,
        message,
      };
    } catch (err) {
      return {
        id: probe.id,
        origin: probe.origin,
        method: probe.method,
        allowCredentials: false,
        verdict: 'info',
        message: 'Request failed; test not evaluated.',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
