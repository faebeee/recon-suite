import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  ErrorPageProbe,
  HstsInfo,
  HttpMethodsOutput,
  HttpMethodsParams,
  HttpsRedirectProbe,
  MethodsProbe,
  TraceProbe,
} from '@recon/shared';
import type { Headers } from 'undici';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextPrefix } from '../../core/http/read-limited.js';
import {
  detectDefaultPage,
  findLeaks,
  isHttpsRedirect,
  methodsFindings,
  parseAllow,
  parseHsts,
  preloadCandidates,
  riskyMethods,
} from './http-methods.analysis.js';

const TIMEOUT_MS = 8000;
const PAGE_BYTES = 256 * 1024;
const PRELOAD_API = 'https://hstspreload.org/api/v2/status';

interface PreloadStatus {
  name?: string;
  status?: string;
  include_subdomains?: boolean;
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

const headerRecord = (h: Headers): Record<string, string> => {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k] = v;
  });
  return out;
};

/**
 * Read-only misconfiguration checks: OPTIONS, a TRACE echo test, the plain-HTTP redirect,
 * HSTS, the 404 page and default install pages. Never sends PUT/DELETE or a request body.
 */
@Injectable()
export class HttpMethodsService {
  constructor(private readonly http: HttpClientService) {}

  async check({ target }: HttpMethodsParams): Promise<HttpMethodsOutput> {
    const { res, finalUrl } = await this.http.targetFollow(target, {
      maxRedirects: 5,
      timeoutMs: TIMEOUT_MS,
    });
    const { text: page } = await readTextPrefix(res, PAGE_BYTES);
    const final = new URL(finalUrl);
    const hsts =
      final.protocol === 'https:'
        ? parseHsts(res.headers.get('strict-transport-security'))
        : { includeSubDomains: false, preload: false };

    const [options, trace, httpsRedirect, errorPage, preloadList] =
      await Promise.all([
        this.options(finalUrl),
        this.trace(finalUrl),
        this.httpsRedirect(final.hostname),
        this.errorPage(final.origin),
        final.protocol === 'https:'
          ? this.preloadList(final.hostname)
          : undefined,
      ]);

    const defaultPage = detectDefaultPage(page);
    const probes = {
      url: finalUrl,
      status: res.status,
      options,
      trace,
      httpsRedirect,
      hsts: { ...hsts, ...(preloadList && { preloadList }) } satisfies HstsInfo,
      errorPage,
      ...(defaultPage && { defaultPage }),
    };
    return { ...probes, findings: methodsFindings(probes) };
  }

  private async options(url: string): Promise<MethodsProbe> {
    try {
      const res = await this.http.target(url, {
        method: 'OPTIONS',
        redirect: 'manual',
        timeoutMs: TIMEOUT_MS,
      });
      await res.body?.cancel();
      const allowed = parseAllow(
        res.headers.get('allow'),
        res.headers.get('access-control-allow-methods'),
      );
      return { status: res.status, allowed, risky: riskyMethods(allowed) };
    } catch (err) {
      return { allowed: [], risky: [], error: message(err) };
    }
  }

  /** TRACE with a random marker header: an echoing server returns it in the body. */
  private async trace(url: string): Promise<TraceProbe> {
    const marker = randomUUID();
    try {
      const res = await this.http.targetRaw(url, {
        method: 'TRACE',
        headers: { 'x-recon-trace': marker },
        timeoutMs: TIMEOUT_MS,
      });
      return { status: res.status, reflected: res.body.includes(marker) };
    } catch (err) {
      return { reflected: false, error: message(err) };
    }
  }

  private async httpsRedirect(host: string): Promise<HttpsRedirectProbe> {
    const url = `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}/`;
    try {
      const res = await this.http.target(url, {
        redirect: 'manual',
        timeoutMs: TIMEOUT_MS,
      });
      await res.body?.cancel();
      const location = res.headers.get('location') ?? undefined;
      return {
        url,
        status: res.status,
        ...(location && { location }),
        redirectsToHttps: isHttpsRedirect(res.status, location, url),
      };
    } catch (err) {
      return { url, redirectsToHttps: false, error: message(err) };
    }
  }

  private async errorPage(origin: string): Promise<ErrorPageProbe> {
    const url = `${origin}/recon-${randomBytes(6).toString('hex')}-not-found`;
    try {
      const res = await this.http.target(url, {
        redirect: 'manual',
        timeoutMs: TIMEOUT_MS,
      });
      const { text } = await readTextPrefix(res, 64 * 1024);
      return {
        url,
        status: res.status,
        leaks: findLeaks(text, headerRecord(res.headers)),
        soft404: res.status === 200,
      };
    } catch (err) {
      return { url, leaks: [], soft404: false, error: message(err) };
    }
  }

  /**
   * hstspreload.org status of the host, else the first parent that is preloaded with
   * subdomains. The hostname is only query data for this fixed API (trusted client).
   */
  private async preloadList(
    host: string,
  ): Promise<HstsInfo['preloadList'] | undefined> {
    const candidates = preloadCandidates(host);
    let first: HstsInfo['preloadList'] | undefined;
    for (const [i, domain] of candidates.entries()) {
      try {
        const s = await this.http.trustedJson<PreloadStatus>(
          `${PRELOAD_API}?domain=${encodeURIComponent(domain)}`,
          { timeoutMs: 5000, maxBytes: 64 * 1024 },
        );
        if (typeof s.status !== 'string') continue;
        const result = {
          domain,
          status: s.status,
          ...(typeof s.include_subdomains === 'boolean' && {
            includeSubDomains: s.include_subdomains,
          }),
        };
        if (i === 0) first = result;
        if (s.status === 'preloaded' && (i === 0 || s.include_subdomains)) {
          return result;
        }
      } catch {
        // Lookup is best effort; the other checks stand on their own.
        return first;
      }
    }
    return first;
  }
}
