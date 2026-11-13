import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { WaybackOutput, WaybackParams } from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextLimited } from '../../core/http/read-limited.js';
import { analyzeWayback, parseCdxRows } from './wayback.parser.js';

const CDX = 'https://web.archive.org/cdx/search/cdx';
const TIMEOUT_MS = 60_000;
const MAX_BYTES = 20 * 1024 * 1024;
const SLOW =
  'The Internet Archive is often slow or briefly unavailable; try again later.';

export function cdxUrl({
  target,
  includeSubdomains,
  limit,
}: WaybackParams): string {
  const q = new URLSearchParams();
  if (includeSubdomains) {
    q.set('url', target);
    q.set('matchType', 'domain');
  } else {
    q.set('url', `${target}/*`);
  }
  q.set('output', 'json');
  q.set('fl', 'original,timestamp,statuscode,mimetype');
  q.set('collapse', 'urlkey');
  q.set('limit', String(limit));
  return `${CDX}?${q.toString()}`;
}

@Injectable()
export class WaybackService {
  constructor(private readonly http: HttpClientService) {}

  async lookup(params: WaybackParams): Promise<WaybackOutput> {
    let text: string;
    try {
      // Fixed third-party host; the domain is only URL-encoded query data.
      const res = await this.http.trusted(cdxUrl(params), {
        timeoutMs: TIMEOUT_MS,
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new BadGatewayException(
          `web.archive.org responded ${res.status}. ${SLOW}`,
        );
      }
      text = await readTextLimited(res, MAX_BYTES);
    } catch (err) {
      if (err instanceof GatewayTimeoutException) {
        throw new GatewayTimeoutException(`web.archive.org timed out. ${SLOW}`);
      }
      if (err instanceof HttpException) throw err;
      throw new BadGatewayException(`web.archive.org request failed. ${SLOW}`);
    }

    let rows: string[][];
    try {
      rows = parseCdxRows(text.trim() ? JSON.parse(text) : []);
    } catch {
      throw new BadGatewayException(
        `web.archive.org returned an unexpected response. ${SLOW}`,
      );
    }
    return analyzeWayback(params.target, rows, params.limit);
  }
}
