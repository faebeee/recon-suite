import { BadGatewayException, Injectable } from '@nestjs/common';
import type { SubdomainsOutput, SubdomainsParams } from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextLimited } from '../../core/http/read-limited.js';
import { parseCrtSh, type CrtShEntry } from './crtsh.parser.js';

const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;

@Injectable()
export class SubdomainsService {
  constructor(private readonly http: HttpClientService) {}

  async search({
    target,
    includeExpired,
  }: SubdomainsParams): Promise<SubdomainsOutput> {
    const url = new URL('https://crt.sh/');
    url.searchParams.set('q', `%.${target}`);
    url.searchParams.set('output', 'json');
    url.searchParams.set('deduplicate', 'Y');
    if (!includeExpired) url.searchParams.set('exclude', 'expired');

    // crt.sh is slow and flaky under load; give it time.
    const res = await this.http.trusted(url.href, { timeoutMs: 45_000 });
    if (!res.ok) {
      await res.body?.cancel();
      throw new BadGatewayException(
        `crt.sh responded ${res.status}, try again shortly`,
      );
    }

    const text = await readTextLimited(res, MAX_RESPONSE_BYTES);
    let entries: CrtShEntry[];
    try {
      entries = text.trim() ? (JSON.parse(text) as CrtShEntry[]) : [];
    } catch {
      throw new BadGatewayException('crt.sh returned an invalid response');
    }

    const subdomains = parseCrtSh(entries, target);
    return { source: 'crt.sh', total: subdomains.length, subdomains };
  }
}
