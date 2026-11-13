import { NotFoundException } from '@nestjs/common';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { FIXTURES } from './dnssec.fixtures.js';
import type { DohResponse } from './dnssec.parser.js';
import { DnssecService } from './dnssec.service.js';

function fakeHttp(
  answer: (name: string, type: string, cd: string) => DohResponse,
) {
  const trustedJson = vi.fn(async (url: string) => {
    const u = new URL(url);
    expect(u.origin).toBe('https://cloudflare-dns.com');
    return answer(
      u.searchParams.get('name')!,
      u.searchParams.get('type')!,
      u.searchParams.get('cd')!,
    );
  });
  return { trustedJson, http: { trustedJson } as unknown as HttpClientService };
}

describe('DnssecService', () => {
  it('queries DS, DNSKEY, SOA and a random nonexistent name', async () => {
    const { http, trustedJson } = fakeHttp((name, type) => {
      if (name.startsWith('_recon-')) return FIXTURES.cloudflare.nonexistent;
      if (type === 'DS') return FIXTURES.cloudflare.ds;
      if (type === 'DNSKEY') return FIXTURES.cloudflare.dnskey;
      return FIXTURES.cloudflare.soa;
    });
    const out = await new DnssecService(http).check({
      target: 'Cloudflare.com',
    });
    expect(out.status).toBe('secure');
    expect(out.denial).toBe('NSEC');
    expect(trustedJson).toHaveBeenCalledTimes(4);
    const probe = new URL(trustedJson.mock.calls[3]![0]).searchParams.get(
      'name',
    );
    expect(probe).toMatch(/^_recon-[0-9a-f]{12}\.cloudflare\.com$/);
  });

  it('re-queries with cd=1 on SERVFAIL to detect bogus zones', async () => {
    const { http, trustedJson } = fakeHttp((_name, type, cd) =>
      type === 'SOA'
        ? cd === '1'
          ? FIXTURES.bogus.soaUnchecked
          : FIXTURES.bogus.soa
        : { Status: 0 },
    );
    const out = await new DnssecService(http).check({
      target: 'dnssec-failed.org',
    });
    expect(out.status).toBe('bogus');
    expect(trustedJson).toHaveBeenCalledTimes(5);
  });

  it('answers 404 for NXDOMAIN', async () => {
    const { http } = fakeHttp(() => FIXTURES.nxdomain);
    await expect(
      new DnssecService(http).check({ target: 'nonexistent-zzzq123.com' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
