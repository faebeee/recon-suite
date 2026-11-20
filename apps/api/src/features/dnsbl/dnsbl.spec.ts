import type { Lookup } from './dnsbl.lists.js';
import {
  BLOCKLISTS,
  checkList,
  dnsblFindings,
  queryName,
  reverseIpv4,
} from './dnsbl.lists.js';
import { DnsblService } from './dnsbl.service.js';

const list = (name: string) => BLOCKLISTS.find((l) => l.name === name)!;
const nx = () => Object.assign(new Error('nx'), { code: 'ENOTFOUND' });

/** Fake DNS: answers per query name; anything else is NXDOMAIN. */
const dns =
  (answers: Record<string, string[] | Error>): Lookup =>
  async (name) => {
    const a = answers[name];
    if (a instanceof Error) throw a;
    if (!a) throw nx();
    return a;
  };

describe('query names', () => {
  it('reverses IPv4 for IP lists and keeps domains', () => {
    expect(reverseIpv4('192.0.2.10')).toBe('10.2.0.192');
    expect(queryName(list('Spamhaus ZEN'), '192.0.2.10')).toBe(
      '10.2.0.192.zen.spamhaus.org',
    );
    expect(queryName(list('Spamhaus DBL'), 'x.test')).toBe(
      'x.test.dbl.spamhaus.org',
    );
  });
});

describe('checkList', () => {
  const zen = list('Spamhaus ZEN');
  const q = '10.2.0.192.zen.spamhaus.org';

  it('decodes listings', async () => {
    const c = await checkList(
      zen,
      '192.0.2.10',
      dns({ [q]: ['127.0.0.4', '127.0.0.2'] }),
    );
    expect(c).toMatchObject({
      status: 'listed',
      reasons: ['Exploits Block List (XBL)', 'Spamhaus Block List (SBL)'],
    });
    expect(c.policyOnly).toBeUndefined();
  });

  it('marks PBL-only listings as policy', async () => {
    const c = await checkList(zen, '192.0.2.10', dns({ [q]: ['127.0.0.11'] }));
    expect(c.policyOnly).toBe(true);
    expect(dnsblFindings([c])[0]?.status).toBe('info');
  });

  it('treats NXDOMAIN as clean and refusals and odd answers as not evaluated', async () => {
    expect((await checkList(zen, '192.0.2.10', dns({}))).status).toBe('clean');
    expect(
      (await checkList(zen, '192.0.2.10', dns({ [q]: ['127.255.255.254'] })))
        .status,
    ).toBe('refused');
    expect(
      (await checkList(zen, '192.0.2.10', dns({ [q]: ['93.184.216.34'] })))
        .status,
    ).toBe('error');
    expect(
      (
        await checkList(
          zen,
          '192.0.2.10',
          dns({ [q]: Object.assign(new Error('t'), { code: 'ETIMEOUT' }) }),
        )
      ).error,
    ).toBe('ETIMEOUT');
  });

  it('decodes SURBL bitmasks', async () => {
    const c = await checkList(
      list('SURBL'),
      'x.test',
      dns({ 'x.test.multi.surbl.org': ['127.0.0.24'] }),
    );
    expect(c.reasons).toEqual(['Phishing (PH), Malware (MW)']);
  });
});

describe('DnsblService', () => {
  class Fake extends DnsblService {
    constructor(private readonly answers: Record<string, string[]>) {
      super();
    }
    protected override createResolver() {
      return {
        lookup: dns(this.answers),
        resolve6: dns({ 'x.test': ['2001:db8::1'] }),
        servers: ['127.0.0.53'],
      };
    }
  }

  it('checks the domain lists and every IPv4 address on the IP lists', async () => {
    const out = await new Fake({
      'x.test': ['192.0.2.1', '192.0.2.2'],
      '1.2.0.192.bl.spamcop.net': ['127.0.0.2'],
    }).check({ target: 'x.test' });
    expect(out.kind).toBe('domain');
    expect(out.addresses).toEqual(['192.0.2.1', '192.0.2.2']);
    expect(out.skippedIpv6).toEqual(['2001:db8::1']);
    expect(out.checks).toHaveLength(2 + 2 * 5);
    const fails = out.findings.filter((f) => f.status === 'fail');
    expect(fails.map((f) => f.title)).toEqual(['SpamCop: 192.0.2.1']);
  });

  it('rejects IPv6-only targets with a clear message', async () => {
    await expect(new Fake({}).check({ target: '2001:db8::1' })).rejects.toThrow(
      /IPv4-only/,
    );
  });
});
