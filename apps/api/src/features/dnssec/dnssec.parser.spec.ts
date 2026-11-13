import { generateKeyPairSync } from 'node:crypto';
import { FIXTURES } from './dnssec.fixtures.js';
import {
  analyzeDnssec,
  buildDnssecFindings,
  detectDenial,
  parseDnskey,
  parseDs,
  parseRrsig,
  parseSigTime,
  rsaKeyBits,
  type DohResponse,
} from './dnssec.parser.js';

const NOW = new Date(1794555329_000); // when the fixtures were captured
const empty: DohResponse = { Status: 0 };

/** RFC 3110 wire form of an RSA public key. */
function rfc3110(bits: number): string {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: bits });
  const jwk = publicKey.export({ format: 'jwk' });
  const e = Buffer.from(jwk.e!, 'base64url');
  const n = Buffer.from(jwk.n!, 'base64url');
  return Buffer.concat([Buffer.from([e.length]), e, n]).toString('base64');
}

describe('record parsers', () => {
  it('parses DS', () => {
    expect(
      parseDs('2371 13 2 32996839A6D808AFE3EB4A795A0E6A7A39A76FC52FF228B2'),
    ).toEqual({
      keyTag: 2371,
      algorithm: 13,
      algorithmName: 'ECDSAP256SHA256',
      digestType: 2,
      digest: '32996839a6d808afe3eb4a795a0e6a7a39a76fc52ff228b2',
    });
    expect(parseDs('garbage')).toBeUndefined();
  });

  it('parses DNSKEY roles and RSA key sizes', () => {
    expect(parseDnskey('257 3 13 mdsswUyr3DPW132m==')).toMatchObject({
      role: 'KSK',
      algorithmName: 'ECDSAP256SHA256',
    });
    expect(parseDnskey('257 3 13 abc=')?.keyBits).toBeUndefined();
    expect(parseDnskey('256 3 13 abc=')?.role).toBe('ZSK');
    expect(parseDnskey('385 3 8 abc=')?.role).toBe('other'); // revoked KSK
    expect(parseDnskey(`257 3 8 ${rfc3110(1024)}`)).toMatchObject({
      role: 'KSK',
      algorithmName: 'RSASHA256',
      keyBits: 1024,
    });
    expect(rsaKeyBits(rfc3110(2048))).toBe(2048);
  });

  it('handles the long exponent length form', () => {
    const key = Buffer.concat([
      Buffer.from([0, 0, 3, 1, 0, 1]),
      Buffer.alloc(128, 0xff),
    ]);
    expect(rsaKeyBits(key.toString('base64'))).toBe(1024);
  });

  it('parses both RRSIG time formats', () => {
    expect(parseSigTime('20261120120000')?.toISOString()).toBe(
      '2026-11-20T12:00:00.000Z',
    );
    expect(parseSigTime('1794645238')?.toISOString()).toBe(
      new Date(1794645238_000).toISOString(),
    );
    expect(parseSigTime('soon')).toBeUndefined();
    const sig = parseRrsig(
      'SOA 13 2 300 20261110000000 20261020000000 34505 example.com. AAAA',
      NOW,
    );
    expect(sig).toMatchObject({
      typeCovered: 'SOA',
      algorithm: 13,
      signer: 'example.com.',
      lifetimeDays: 21,
    });
    expect(sig!.daysRemaining).toBeLessThan(0);
  });
});

describe('detectDenial', () => {
  it('finds NSEC for the zone and ignores the parent NSEC3', () => {
    expect(
      detectDenial('cloudflare.com', FIXTURES.cloudflare.nonexistent),
    ).toBe('NSEC');
    // NSEC3 records here belong to "com", not to google.com
    expect(detectDenial('google.com', FIXTURES.unsigned.ds)).toBeUndefined();
    expect(detectDenial('com', FIXTURES.unsigned.ds)).toBe('NSEC3');
  });
});

describe('analyzeDnssec', () => {
  it('reports a signed, validating zone', () => {
    const out = analyzeDnssec(
      'cloudflare.com',
      'doh',
      FIXTURES.cloudflare,
      NOW,
    );
    expect(out.status).toBe('secure');
    expect(out.ds).toEqual([
      expect.objectContaining({ keyTag: 2371, digestType: 2 }),
    ]);
    expect(out.dnskeys.map((k) => k.role).sort()).toEqual(['KSK', 'ZSK']);
    expect(out.signatures.map((s) => s.typeCovered)).toEqual([
      'DS',
      'DNSKEY',
      'SOA',
    ]);
    expect(out.denial).toBe('NSEC');
    // short-lived online signatures do not trigger the expiry warning
    expect(out.findings.map((f) => [f.id, f.status])).toEqual([
      ['dnssec.status', 'pass'],
      ['dnssec.rrsig.valid', 'pass'],
    ]);
  });

  it('reports an unsigned zone as insecure', () => {
    const out = analyzeDnssec(
      'google.com',
      'doh',
      {
        ds: FIXTURES.unsigned.ds,
        dnskey: empty,
        soa: { Status: 0, AD: false },
        nonexistent: empty,
      },
      NOW,
    );
    expect(out.status).toBe('insecure');
    expect(out.findings[0]).toMatchObject({
      status: 'warn',
      title: 'Domain is not signed',
    });
  });

  it('detects a bogus zone from SERVFAIL with cd=0 and NOERROR with cd=1', () => {
    const out = analyzeDnssec(
      'dnssec-failed.org',
      'doh',
      {
        ds: {
          Status: 0,
          Answer: [{ name: 'x', type: 43, data: '106 5 1 AB' }],
        },
        dnskey: empty,
        soa: FIXTURES.bogus.soa,
        soaUnchecked: FIXTURES.bogus.soaUnchecked,
        nonexistent: empty,
      },
      NOW,
    );
    expect(out.status).toBe('bogus');
    const ids = out.findings.map((f) => [f.id, f.status]);
    expect(ids).toContainEqual(['dnssec.status', 'fail']);
    expect(ids).toContainEqual(['dnssec.alg.5', 'warn']);
    expect(ids).toContainEqual(['dnssec.ds.sha1', 'warn']);
    expect(out.signatures).toHaveLength(1);
  });

  it('is indeterminate with a DS but no authenticated answer', () => {
    const out = analyzeDnssec(
      'x.test',
      'doh',
      {
        ds: FIXTURES.cloudflare.ds,
        dnskey: empty,
        soa: { Status: 0, AD: false },
        nonexistent: empty,
      },
      NOW,
    );
    expect(out.status).toBe('indeterminate');
  });
});

describe('buildDnssecFindings', () => {
  const sig = (daysRemaining: number, lifetimeDays: number) => ({
    typeCovered: 'SOA',
    algorithm: 8,
    signer: 'x.test.',
    inception: '',
    expiration: 'exp',
    daysRemaining,
    lifetimeDays,
  });

  it('flags forbidden algorithms, short KSKs and signature expiry', () => {
    const f = buildDnssecFindings({
      domain: 'x.test',
      status: 'secure',
      ds: [],
      dnskeys: [
        {
          flags: 257,
          role: 'KSK',
          algorithm: 1,
          algorithmName: 'RSAMD5',
          keyBits: 1024,
        },
      ],
      signatures: [sig(-1, 30), sig(3, 30), sig(1, 2)],
    });
    const ids = f.map((x) => [x.id, x.status]);
    expect(ids).toEqual([
      ['dnssec.status', 'pass'],
      ['dnssec.alg.1', 'fail'],
      ['dnssec.ksk.size', 'warn'],
      ['dnssec.rrsig.expired', 'fail'],
      ['dnssec.rrsig.expiring', 'warn'],
    ]);
  });
});
