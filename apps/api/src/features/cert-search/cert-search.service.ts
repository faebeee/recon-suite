import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import type { CertSearchOutput, CertSearchParams } from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextLimited } from '../../core/http/read-limited.js';
import { aggregateOrgCerts, type CrtShOrgEntry } from './cert-search.parser.js';

const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;
const SLOW_HINT = 'crt.sh is often slow, try again in a minute.';

/** Passive: certificate transparency search on crt.sh (fixed host, organisation as data). */
@Injectable()
export class CertSearchService {
  constructor(private readonly http: HttpClientService) {}

  async search({
    target,
    includeExpired,
  }: CertSearchParams): Promise<CertSearchOutput> {
    // `O=` matches the subject organisation. `exclude=expired` is not supported for this
    // search (crt.sh answers 404), so expiry is filtered in aggregateOrgCerts.
    const url = new URL('https://crt.sh/');
    url.searchParams.set('O', target);
    url.searchParams.set('output', 'json');

    let res;
    try {
      res = await this.http.trusted(url.href, { timeoutMs: 60_000 });
    } catch (err) {
      if (err instanceof GatewayTimeoutException) {
        throw new GatewayTimeoutException(
          `crt.sh did not answer within 60 s. ${SLOW_HINT}`,
        );
      }
      throw err;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new BadGatewayException(
        `crt.sh responded ${res.status}. ${SLOW_HINT}`,
      );
    }

    let text: string;
    try {
      text = await readTextLimited(res, MAX_RESPONSE_BYTES);
    } catch (err) {
      // The fetch timeout also aborts a body that is still streaming.
      if (
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')
      ) {
        throw new GatewayTimeoutException(
          `crt.sh did not finish within 60 s. ${SLOW_HINT}`,
        );
      }
      throw err;
    }
    let entries: CrtShOrgEntry[];
    try {
      const parsed: unknown = text.trim() ? JSON.parse(text) : [];
      if (!Array.isArray(parsed)) throw new Error('not an array');
      entries = parsed as CrtShOrgEntry[];
    } catch {
      throw new BadGatewayException(
        `crt.sh returned an invalid response. ${SLOW_HINT}`,
      );
    }

    return {
      organisation: target,
      source: 'crt.sh',
      ...aggregateOrgCerts(entries, { includeExpired }),
    };
  }
}
