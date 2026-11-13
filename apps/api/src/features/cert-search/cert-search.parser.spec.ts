import {
  aggregateOrgCerts,
  apexOf,
  toHostname,
  type CrtShOrgEntry,
} from './cert-search.parser.js';

const ORG = 'Internet Corporation for Assigned Names and Numbers';
/** Shape of real crt.sh `?O=` rows (Nov 2026), trimmed. */
const row = (
  common_name: string,
  serial: string,
  not_before: string,
  not_after: string,
): CrtShOrgEntry => ({
  issuer_ca_id: 204411,
  common_name,
  name_value: ORG,
  id: Number.parseInt(serial, 16),
  serial_number: serial,
  not_before,
  not_after,
});

const NOW = new Date('2026-11-13T00:00:00Z');
const entries = [
  row('access.icann.org', 'a1', '2026-09-28T00:00:00', '2027-04-14T23:59:59'),
  // precertificate + certificate: same issuer and serial
  row('access.icann.org', 'a1', '2026-09-28T00:00:00', '2027-04-14T23:59:59'),
  row('access.icann.org', 'a0', '2025-03-01T00:00:00', '2025-09-01T00:00:00'),
  row('*.icann.org', 'b1', '2026-01-01T00:00:00', '2027-01-01T00:00:00'),
  row('*.iana.org', 'c1', '2026-02-01T00:00:00', '2027-02-01T00:00:00'),
  row('Paul Hoffman', 'd1', '2026-02-01T00:00:00', '2027-02-01T00:00:00'),
  row('192.0.2.10', 'e1', '2026-02-01T00:00:00', '2027-02-01T00:00:00'),
  row('ops@icann.org', 'f1', '2026-02-01T00:00:00', '2027-02-01T00:00:00'),
  row('www.example.co.uk', 'g1', '2026-02-01T00:00:00', '2027-02-01T00:00:00'),
];

describe('aggregateOrgCerts', () => {
  it('skips expired certificates unless asked and dedupes precertificates', () => {
    const out = aggregateOrgCerts(entries, { includeExpired: false, now: NOW });
    expect(out.certificates).toBe(7);
    expect(out.domains.map((d) => d.name)).toEqual([
      'access.icann.org',
      'iana.org',
      'icann.org',
      'www.example.co.uk',
    ]);
    expect(out.domains.find((d) => d.name === 'icann.org')?.wildcard).toBe(
      true,
    );
    expect(out.domains[0]).toMatchObject({
      certificates: 1,
      firstSeen: '2026-09-28T00:00:00',
    });
  });

  it('includes expired certificates and widens first/last seen', () => {
    const out = aggregateOrgCerts(entries, { includeExpired: true, now: NOW });
    expect(out.certificates).toBe(8);
    expect(out.domains[0]).toMatchObject({
      name: 'access.icann.org',
      certificates: 2,
      firstSeen: '2025-03-01T00:00:00',
      lastSeen: '2027-04-14T23:59:59',
    });
  });

  it('lists apex domains by frequency', () => {
    const out = aggregateOrgCerts(entries, { includeExpired: true, now: NOW });
    expect(out.apexDomains).toEqual(['icann.org', 'example.co.uk', 'iana.org']);
  });

  it('caps the domain list at 2000', () => {
    const many = Array.from({ length: 2100 }, (_, i) =>
      row(
        `h${i}.example.com`,
        `s${i}`,
        '2026-01-01T00:00:00',
        '2027-01-01T00:00:00',
      ),
    );
    const out = aggregateOrgCerts(many, { includeExpired: false, now: NOW });
    expect(out.domains).toHaveLength(2000);
    expect(out.certificates).toBe(2100);
  });

  it('returns empty lists for no rows', () => {
    expect(aggregateOrgCerts([], { includeExpired: false })).toEqual({
      certificates: 0,
      domains: [],
      apexDomains: [],
    });
  });
});

describe('toHostname', () => {
  it.each([
    ['*.Example.COM', { name: 'example.com', wildcard: true }],
    ['host.example.com.', { name: 'host.example.com', wildcard: false }],
    ['Paul Hoffman 20180613', undefined],
    ['user@example.com', undefined],
    ['192.0.2.1', undefined],
    ['localhost', undefined],
  ])('%s', (raw, out) => expect(toHostname(raw)).toEqual(out));
});

describe('apexOf', () => {
  it.each([
    ['a.b.example.com', 'example.com'],
    ['www.example.co.uk', 'example.co.uk'],
    ['shop.example.com.au', 'example.com.au'],
    ['example.de', 'example.de'],
  ])('%s -> %s', (name, apex) => expect(apexOf(name)).toBe(apex));
});
