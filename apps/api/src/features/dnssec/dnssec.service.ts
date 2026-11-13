import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { DnssecOutput, DnssecParams } from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import {
  analyzeDnssec,
  DNS_STATUS,
  type DnssecResponses,
  type DohResponse,
} from './dnssec.parser.js';

const DOH_URL = 'https://cloudflare-dns.com/dns-query';
const RESOLVER = 'Cloudflare DNS-over-HTTPS (1.1.1.1)';

@Injectable()
export class DnssecService {
  constructor(private readonly http: HttpClientService) {}

  async check({ target }: DnssecParams): Promise<DnssecOutput> {
    const domain = target.toLowerCase().replace(/\.$/, '');
    const probe = `_recon-${randomBytes(6).toString('hex')}.${domain}`;

    // Records are fetched with checking disabled so they are visible even when the
    // chain is broken; the validation verdict comes from the SOA query with cd=0.
    const [ds, dnskey, soa, nonexistent] = await Promise.all([
      this.query(domain, 'DS', true),
      this.query(domain, 'DNSKEY', true),
      this.query(domain, 'SOA', false),
      this.query(probe, 'A', true),
    ]);
    if (soa.Status === DNS_STATUS.NXDOMAIN) {
      throw new NotFoundException(`NXDOMAIN: ${domain} does not exist`);
    }
    const responses: DnssecResponses = { ds, dnskey, soa, nonexistent };
    if (soa.Status === DNS_STATUS.SERVFAIL) {
      responses.soaUnchecked = await this.query(domain, 'SOA', true);
    }
    return analyzeDnssec(domain, RESOLVER, responses, new Date());
  }

  private query(name: string, type: string, cd: boolean): Promise<DohResponse> {
    const url = new URL(DOH_URL);
    url.searchParams.set('name', name);
    url.searchParams.set('type', type);
    url.searchParams.set('do', '1');
    url.searchParams.set('cd', cd ? '1' : '0');
    return this.http.trustedJson<DohResponse>(url.href, {
      timeoutMs: 8000,
      headers: { accept: 'application/dns-json' },
    });
  }
}
