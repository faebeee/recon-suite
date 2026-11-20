import { NotFoundException } from '@nestjs/common';
import type { TargetGuardService } from '../../core/net/target-guard.service.js';
import { TlsAuditService } from './tls-audit.service.js';
import type { ProbeOptions, ProbeResult } from './tls-probe.js';

const guard = (blocked = false) =>
  ({
    resolve: vi.fn(async (host: string) => {
      if (blocked) throw new NotFoundException('unresolvable');
      return { host, addresses: ['93.184.216.34'] };
    }),
  }) as unknown as TargetGuardService;

const SCT_OID = Buffer.from([
  0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0xd6, 0x79, 0x02, 0x04, 0x02,
]);

/** Fake server: accepts `protocols` and, per protocol, the listed suites. */
function fakeServer(accept: Record<string, string[]>) {
  const calls: ProbeOptions[] = [];
  const probe = vi.fn(async (o: ProbeOptions): Promise<ProbeResult> => {
    calls.push(o);
    const suites = accept[o.version ?? 'TLSv1.3'];
    if (!suites) {
      return { ok: false, local: false, network: false, message: 'alert 70' };
    }
    const requested = o.ciphers?.split(':')[0];
    const name = !requested || requested === 'DEFAULT' ? suites[0]! : requested;
    if (!suites.includes(name)) {
      return { ok: false, local: false, network: false, message: 'alert 40' };
    }
    return {
      ok: true,
      protocol: o.version ?? 'TLSv1.3',
      cipher: { name, standardName: `std-${name}` },
      keyExchange: 'X25519',
      ocspStapled: o.requestOCSP ? true : undefined,
      certificateDer: o.requestOCSP
        ? Buffer.concat([Buffer.from([0x30]), SCT_OID])
        : undefined,
    };
  });
  return { probe, calls };
}

function makeService(
  probe: ReturnType<typeof fakeServer>['probe'],
  g = guard(),
) {
  const s = new TlsAuditService(g);
  s.probe = probe;
  s.candidates = () => [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-SHA',
    'AES128-SHA',
    'DES-CBC3-SHA',
  ];
  return s;
}

describe('TlsAuditService', () => {
  it('enumerates protocols and ciphers, connects to the resolved IP with SNI', async () => {
    const { probe, calls } = fakeServer({
      TLSv1: ['ECDHE-RSA-AES128-SHA', 'DES-CBC3-SHA'],
      'TLSv1.2': ['ECDHE-RSA-AES128-GCM-SHA256', 'AES128-SHA'],
      'TLSv1.3': ['TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384'],
    });
    const out = await makeService(probe).audit({
      target: 'example.com',
      port: 443,
    });

    expect(calls.every((c) => c.address === '93.184.216.34')).toBe(true);
    expect(calls.every((c) => c.servername === 'example.com')).toBe(true);
    expect(out.protocols.map((p) => p.supported)).toEqual([
      true,
      false,
      true,
      true,
    ]);
    // TLS 1.0 probes skip TLS 1.2-only suites.
    expect(
      calls.some(
        (c) =>
          c.version === 'TLSv1' &&
          c.ciphers?.startsWith('ECDHE-RSA-AES128-GCM'),
      ),
    ).toBe(false);
    expect(
      out.ciphers.map((c) => `${c.protocol} ${c.name} ${c.strength}`),
    ).toEqual([
      'TLSv1 ECDHE-RSA-AES128-SHA weak',
      'TLSv1 DES-CBC3-SHA weak',
      'TLSv1.2 ECDHE-RSA-AES128-GCM-SHA256 strong',
      'TLSv1.2 AES128-SHA weak',
      'TLSv1.3 TLS_AES_128_GCM_SHA256 strong',
      'TLSv1.3 TLS_AES_256_GCM_SHA384 strong',
    ]);
    expect(out.ocspStapling).toBe(true);
    expect(out.certificateTransparency).toBe(true);
    expect(out.keyExchange).toBe('X25519');
    expect(
      out.report.findings.find((f) => f.id === 'tls.protocol.1_0')?.status,
    ).toBe('fail');
    expect(out.report.grade).toBe('B');
  });

  it('omits SNI for IP targets', async () => {
    const { probe, calls } = fakeServer({
      'TLSv1.3': ['TLS_AES_128_GCM_SHA256'],
    });
    await makeService(probe).audit({ target: '93.184.216.34', port: 8443 });
    expect(
      calls.every((c) => c.servername === undefined && c.port === 8443),
    ).toBe(true);
  });

  it('reports protocols the local OpenSSL cannot offer as errors', async () => {
    const { probe } = fakeServer({ 'TLSv1.3': ['TLS_AES_128_GCM_SHA256'] });
    const wrapped = vi.fn(async (o: ProbeOptions): Promise<ProbeResult> =>
      o.version === 'TLSv1'
        ? {
            ok: false,
            local: true,
            network: false,
            message: 'ERR_SSL_NO_PROTOCOLS_AVAILABLE',
          }
        : probe(o),
    );
    const s = makeService(probe);
    s.probe = wrapped;
    const out = await s.audit({ target: 'example.com', port: 443 });
    expect(out.protocols[0]).toMatchObject({ supported: false });
    expect(out.protocols[0]?.error).toContain('ERR_SSL_NO_PROTOCOLS_AVAILABLE');
  });

  it('throws 502 when nothing handshakes', async () => {
    const { probe } = fakeServer({});
    await expect(
      makeService(probe).audit({ target: 'example.com', port: 22 }),
    ).rejects.toThrow(/No TLS handshake succeeded/);
  });

  it('throws 504 when every connection times out', async () => {
    const s = makeService(fakeServer({}).probe);
    s.probe = vi.fn(async () => ({
      ok: false as const,
      local: false,
      network: true,
      message: 'Handshake timed out after 5000 ms',
    }));
    await expect(s.audit({ target: 'example.com', port: 443 })).rejects.toThrow(
      /timed out/,
    );
  });

  it('stops enumerating when the time budget is spent', async () => {
    const { probe } = fakeServer({ 'TLSv1.2': ['AES128-SHA'] });
    const s = makeService(probe);
    s.budgetMs = -1;
    const out = await s.audit({ target: 'example.com', port: 443 });
    expect(out.ciphers).toEqual([]);
    expect(
      out.report.findings.some((f) => f.id === 'tls.ciphers.incomplete'),
    ).toBe(true);
  });

  it('propagates resolve errors', async () => {
    const { probe } = fakeServer({});
    await expect(
      makeService(probe, guard(true)).audit({ target: 'x.test', port: 443 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
