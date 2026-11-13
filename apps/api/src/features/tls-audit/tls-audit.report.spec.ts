import type { TlsCipherResult, TlsProtocolResult } from '@recon/shared';
import {
  buildTlsFindings,
  buildTlsReport,
  formatKeyExchange,
  hasEmbeddedScts,
} from './tls-audit.report.js';

const protocols = (
  s: [boolean, boolean, boolean, boolean],
): TlsProtocolResult[] =>
  (['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'] as const).map((version, i) => ({
    version,
    supported: s[i]!,
  }));

const strong: TlsCipherResult = {
  protocol: 'TLSv1.3',
  name: 'TLS_AES_128_GCM_SHA256',
  strength: 'strong',
  notes: [],
};

describe('buildTlsReport', () => {
  it('gives A+ to a modern configuration', () => {
    const r = buildTlsReport({
      protocols: protocols([false, false, true, true]),
      ciphers: [strong],
      ocspStapling: true,
      certificateTransparency: true,
    });
    expect(r.grade).toBe('A+');
    expect(r.findings.every((f) => f.status === 'pass')).toBe(true);
  });

  it('fails legacy protocols and insecure suites, warns on weak ones', () => {
    const findings = buildTlsFindings({
      protocols: protocols([true, true, true, false]),
      ciphers: [
        {
          ...strong,
          protocol: 'TLSv1.2',
          name: 'RC4-SHA',
          strength: 'insecure',
        },
        {
          ...strong,
          protocol: 'TLSv1',
          name: 'DES-CBC3-SHA',
          strength: 'weak',
        },
        {
          ...strong,
          protocol: 'TLSv1.2',
          name: 'DES-CBC3-SHA',
          strength: 'weak',
        },
      ],
      ocspStapling: false,
      certificateTransparency: false,
    });
    const by = (id: string) => findings.find((f) => f.id === id);
    expect(by('tls.protocol.1_0')?.status).toBe('fail');
    expect(by('tls.protocol.1_1')?.status).toBe('fail');
    expect(by('tls.protocol.1_2')?.status).toBe('pass');
    expect(by('tls.protocol.1_3')?.status).toBe('warn');
    expect(by('tls.ciphers.insecure')).toMatchObject({
      status: 'fail',
      value: 'RC4-SHA',
    });
    expect(by('tls.ciphers.weak')).toMatchObject({
      status: 'warn',
      value: 'DES-CBC3-SHA',
    });
    expect(by('tls.ocsp')?.status).toBe('warn');
    expect(by('tls.ct')?.status).toBe('warn');
  });

  it('reports untestable protocols, unknown checks and early stops as info', () => {
    const findings = buildTlsFindings({
      protocols: [
        { version: 'TLSv1', supported: false, error: 'no protocols' },
        ...protocols([false, false, true, true]).slice(1),
      ],
      ciphers: [strong],
      ocspStapling: null,
      certificateTransparency: null,
      incomplete: true,
    });
    const info = findings.filter((f) => f.status === 'info').map((f) => f.id);
    expect(info).toEqual([
      'tls.protocol.1_0',
      'tls.ocsp',
      'tls.ct',
      'tls.ciphers.incomplete',
    ]);
  });
});

describe('hasEmbeddedScts', () => {
  const oid = [
    0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0xd6, 0x79, 0x02, 0x04, 0x02,
  ];
  it('finds the SCT list extension OID in DER', () => {
    const der = Buffer.from([0x30, 0x82, 0x01, 0x00, ...oid, 0x04, 0x81, 0xf0]);
    expect(hasEmbeddedScts(der)).toBe(true);
  });
  it('ignores certificates without it', () => {
    const der = Buffer.from([0x30, 0x82, ...oid.slice(0, -1), 0x03]);
    expect(hasEmbeddedScts(der)).toBe(false);
  });
});

describe('formatKeyExchange', () => {
  it('formats ephemeral key info', () => {
    expect(formatKeyExchange({ type: 'ECDH', name: 'X25519', size: 253 })).toBe(
      'ECDH X25519 253 bits',
    );
    expect(
      formatKeyExchange({ type: 'TLSGroup', name: 'X25519MLKEM768' }),
    ).toBe('X25519MLKEM768');
    expect(formatKeyExchange({ type: 'DH', size: 2048 })).toBe('DH 2048 bits');
    expect(formatKeyExchange({})).toBeUndefined();
    expect(formatKeyExchange(null)).toBeUndefined();
  });
});
