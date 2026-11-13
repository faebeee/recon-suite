import {
  canonicalIp,
  cymruOriginName,
  expandIpv6,
  parseCymruAsName,
  parseCymruOrigin,
  parseRdapNetwork,
  providerForAsn,
} from './ip-intel.parser.js';

describe('ip-intel parser', () => {
  it('expands IPv6 addresses', () => {
    expect(expandIpv6('2606:4700::1111')).toBe(
      '2606:4700:0000:0000:0000:0000:0000:1111',
    );
    expect(expandIpv6('::1')).toBe('0000:0000:0000:0000:0000:0000:0000:0001');
    expect(expandIpv6('::ffff:1.2.3.4')).toBe(
      '0000:0000:0000:0000:0000:ffff:0102:0304',
    );
    expect(canonicalIp('2606:4700:0:0:0:0:0:1111')).toBe(
      canonicalIp('2606:4700::1111'),
    );
  });

  it('builds Team Cymru query names', () => {
    expect(cymruOriginName('1.2.3.4')).toBe('4.3.2.1.origin.asn.cymru.com');
    expect(cymruOriginName('2001:db8::1')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.origin6.asn.cymru.com',
    );
  });

  it('parses Team Cymru answers', () => {
    expect(
      parseCymruOrigin('13335 | 1.1.1.0/24 | AU | apnic | 2011-08-11'),
    ).toEqual({
      number: 13335,
      prefix: '1.1.1.0/24',
      country: 'AU',
      registry: 'apnic',
      allocated: '2011-08-11',
    });
    expect(
      parseCymruOrigin('15169 36040 | 8.8.8.0/24 | US | arin |')?.number,
    ).toBe(15169);
    expect(parseCymruOrigin('garbage')).toBeUndefined();
    expect(
      parseCymruAsName('13335 | US | arin | 2010-07-14 | CLOUDFLARENET, US'),
    ).toBe('CLOUDFLARENET, US');
  });

  it('extracts the RDAP network', () => {
    expect(
      parseRdapNetwork({
        handle: 'NET-1',
        name: 'EXAMPLE-NET',
        type: 'ASSIGNMENT',
        country: 'CH',
        cidr0_cidrs: [{ v4prefix: '192.0.2.0', length: 24 }],
        entities: [
          {
            roles: ['abuse'],
            vcardArray: ['vcard', [['fn', {}, 'text', 'Abuse']]],
          },
          {
            roles: ['registrant'],
            vcardArray: ['vcard', [['fn', {}, 'text', 'Example AG']]],
          },
        ],
      }),
    ).toEqual({
      name: 'EXAMPLE-NET',
      handle: 'NET-1',
      cidr: ['192.0.2.0/24'],
      country: 'CH',
      type: 'ASSIGNMENT',
      organisation: 'Example AG',
    });
  });

  it('maps known ASNs to providers', () => {
    expect(providerForAsn(13335)).toEqual({ name: 'Cloudflare', kind: 'cdn' });
    expect(providerForAsn(64512)).toBeUndefined();
  });
});
