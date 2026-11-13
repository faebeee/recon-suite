import { tlsFindings } from './tls.findings.js';

const base = {
  address: '1.2.3.4',
  port: 443,
  protocol: 'TLSv1.3',
  cipher: { name: 'TLS_AES_128_GCM_SHA256', version: 'TLSv1.3' },
  authorized: true,
  certificate: {
    subject: 'CN=x',
    issuer: 'CN=ca',
    validFrom: '',
    validTo: '2027-01-01',
    daysRemaining: 90,
    serialNumber: '',
    fingerprint256: '',
    subjectAltNames: [],
    keyBits: 2048,
    selfSigned: false,
  },
  chain: [],
};

describe('tlsFindings', () => {
  it('passes a healthy certificate', () => {
    expect(tlsFindings(base as never).every((f) => f.status === 'pass')).toBe(
      true,
    );
  });

  it('fails untrusted, expired and legacy protocol', () => {
    const f = tlsFindings({
      ...base,
      protocol: 'TLSv1',
      authorized: false,
      authorizationError: 'DEPTH_ZERO_SELF_SIGNED_CERT',
      certificate: { ...base.certificate, daysRemaining: -3, selfSigned: true },
    } as never);
    expect(f.filter((x) => x.status === 'fail').map((x) => x.id)).toEqual([
      'tls.trust',
      'tls.expiry',
      'tls.protocol',
    ]);
  });
});
