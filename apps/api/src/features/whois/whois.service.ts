import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isIpLiteral, type WhoisOutput, type WhoisParams } from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { domainCandidates, parseRdap, type RdapObject } from './rdap.parser.js';

const RDAP_BOOTSTRAP = 'https://rdap.org';

@Injectable()
export class WhoisService {
  constructor(private readonly http: HttpClientService) {}

  async lookup({ target }: WhoisParams): Promise<WhoisOutput> {
    if (isIpLiteral(target)) {
      // Validated IP literal; rdap.org rejects percent-encoded IPv6 colons.
      const url = `${RDAP_BOOTSTRAP}/ip/${target}`;
      const raw = await this.fetchRdap(url);
      if (!raw) throw new NotFoundException(`No RDAP record for ${target}`);
      return parseRdap(raw, 'ip', target, url);
    }

    // Registries only know registrable domains: walk up from the full name.
    for (const candidate of domainCandidates(target)) {
      const url = `${RDAP_BOOTSTRAP}/domain/${encodeURIComponent(candidate)}`;
      const raw = await this.fetchRdap(url);
      if (raw) return parseRdap(raw, 'domain', candidate, url);
    }
    throw new NotFoundException(
      `No RDAP record for ${target} or its parent domains`,
    );
  }

  /** Returns null on 404 so the caller can try the parent domain. */
  private async fetchRdap(url: string): Promise<RdapObject | null> {
    const res = await this.http.trusted(url, {
      headers: { accept: 'application/rdap+json, application/json' },
      timeoutMs: 15_000,
    });
    if (res.status === 404) {
      await res.body?.cancel();
      return null;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new BadGatewayException(
        `RDAP server responded ${res.status} for ${url}`,
      );
    }
    return (await res.json()) as RdapObject;
  }
}
