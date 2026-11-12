import { Injectable } from '@nestjs/common';
import type {
  HttpHeadersOutput,
  HttpHeadersParams,
  HttpHop,
} from '@recon/shared';
import type { Response } from 'undici';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { analyzeSecurityHeaders } from './security-headers.js';

const MAX_REDIRECTS = 10;

@Injectable()
export class HttpHeadersService {
  constructor(private readonly http: HttpClientService) {}

  async inspect({
    target,
    method,
    followRedirects,
  }: HttpHeadersParams): Promise<HttpHeadersOutput> {
    const hops: HttpHop[] = [];
    let url = target;
    let res: Response;

    for (let i = 0; ; i++) {
      const t0 = performance.now();
      res = await this.http.target(url, {
        method,
        redirect: 'manual',
        timeoutMs: 10_000,
      });
      await res.body?.cancel();

      const location = res.headers.get('location') ?? undefined;
      hops.push({
        url,
        status: res.status,
        statusText: res.statusText,
        location,
        durationMs: Math.round(performance.now() - t0),
      });

      const isRedirect = res.status >= 300 && res.status < 400 && location;
      if (!followRedirects || !isRedirect || i >= MAX_REDIRECTS) break;

      const next = new URL(location, url);
      if (next.protocol !== 'http:' && next.protocol !== 'https:') break;
      url = next.href;
    }

    const headers = collectHeaders(res);
    return {
      finalUrl: url,
      status: res.status,
      hops,
      headers,
      security: analyzeSecurityHeaders(headers, url.startsWith('https:')),
    };
  }
}

function collectHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    out[key] = value;
  });
  const cookies = res.headers.getSetCookie();
  if (cookies.length) out['set-cookie'] = cookies.join('\n');
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}
