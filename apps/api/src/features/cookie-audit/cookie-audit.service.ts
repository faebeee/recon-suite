import { Injectable } from '@nestjs/common';
import {
  MAX_AUDITED_COOKIES,
  type AuditedCookie,
  type CookieAuditHop,
  type CookieAuditOutput,
  type CookieAuditParams,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import {
  auditCookie,
  cookieFindings,
  dedupeCookies,
  parseSetCookie,
} from './cookie-audit.analysis.js';

const MAX_REDIRECTS = 10;
const TIMEOUT_MS = 10_000;

@Injectable()
export class CookieAuditService {
  constructor(private readonly http: HttpClientService) {}

  async audit({ target }: CookieAuditParams): Promise<CookieAuditOutput> {
    const hops: CookieAuditHop[] = [];
    const audited: AuditedCookie[] = [];
    let url = target;

    // Hop by hop (every hop guarded), because login redirects often set the session cookie.
    for (let i = 0; ; i++) {
      const res = await this.http.target(url, {
        redirect: 'manual',
        timeoutMs: TIMEOUT_MS,
      });
      await res.body?.cancel();
      const { hostname, protocol } = new URL(url);
      const now = new Date();
      const headers = res.headers.getSetCookie();
      for (const header of headers) {
        const parsed = parseSetCookie(header, now);
        if (parsed) {
          audited.push(
            auditCookie(parsed, url, {
              host: hostname,
              https: protocol === 'https:',
            }),
          );
        }
      }
      hops.push({ url, status: res.status, cookies: headers.length });

      const location = res.headers.get('location');
      const isRedirect = res.status >= 300 && res.status < 400 && location;
      if (!isRedirect || i >= MAX_REDIRECTS) break;
      const next = new URL(location, url);
      if (next.protocol !== 'http:' && next.protocol !== 'https:') break;
      url = next.href;
    }

    const unique = dedupeCookies(audited);
    const cookies = unique.slice(0, MAX_AUDITED_COOKIES);
    return {
      finalUrl: url,
      hops,
      cookies,
      truncated: unique.length > cookies.length,
      ...cookieFindings(cookies),
    };
  }
}
