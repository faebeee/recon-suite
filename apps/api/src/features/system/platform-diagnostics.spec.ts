import {
  diagnosePlatform,
  formatDiagnosis,
  type HostFacts,
} from './platform-diagnostics.js';

function facts(overrides: Partial<HostFacts> = {}): HostFacts {
  return {
    platform: 'linux',
    has: () => true,
    macosHelperInstalled: false,
    isRoot: true,
    inContainer: false,
    hasIpv4Interface: true,
    netRawAllowed: true,
    apiKeys: { nvd: true, securityTrails: true },
    ...overrides,
  };
}

const byId = (h: HostFacts) =>
  Object.fromEntries(diagnosePlatform(h).map((r) => [r.id, r]));

describe('diagnosePlatform', () => {
  it('marks key-based tools unavailable without API keys', () => {
    const r = byId(facts({ apiKeys: { nvd: false, securityTrails: false } }));
    expect(r['cve-lookup']).toMatchObject({ status: 'unavailable' });
    expect(r['reverse-ip']).toMatchObject({ status: 'unavailable' });
    expect(r.dns).toMatchObject({ status: 'ok' });
  });

  it('reports every tool ok on a fully equipped Linux host', () => {
    expect(diagnosePlatform(facts()).every((r) => r.status === 'ok')).toBe(
      true,
    );
  });

  it('names the missing Linux packages', () => {
    const r = byId(facts({ has: () => false }));
    expect(r.wifi).toMatchObject({ status: 'unavailable' });
    expect(r.wifi!.fix).toContain('network-manager');
    expect(r.bluetooth!.fix).toContain('bluez');
    expect(r['host-scan']!.fix).toContain('nmap');
    expect(r.nmap!.fix).toContain('compose:up');
    expect(r.dns!.status).toBe('ok');
  });

  it('mentions containers when running inside one', () => {
    const r = byId(facts({ has: () => false, inContainer: true }));
    expect(r.wifi!.reason).toContain('container');
  });

  it('flags a non-root host scan as limited (no ARP)', () => {
    const r = byId(facts({ isRoot: false }));
    expect(r['host-scan']).toMatchObject({ status: 'limited' });
    expect(r['host-scan']!.fix).toContain('KALI_CONTAINER');
  });

  it('reports a missing NET_RAW capability', () => {
    const r = byId(facts({ inContainer: true, netRawAllowed: false }));
    expect(r['host-scan']).toMatchObject({ status: 'unavailable' });
    expect(r['host-scan']!.fix).toContain('NET_RAW');
  });

  it('delegates host scan and nmap to the Kali container', () => {
    const kali = { container: 'recon-kali', cli: 'docker' } as const;
    const r = byId(
      facts({ platform: 'win32', kali, has: (c) => c === 'docker' }),
    );
    expect(r['host-scan']!.status).toBe('ok');
    expect(r.nmap!.status).toBe('ok');
    const missing = byId(facts({ kali, has: () => false }));
    expect(missing.nmap).toMatchObject({ status: 'unavailable' });
    expect(missing.nmap!.reason).toContain('docker');
  });

  it('suggests the macOS helper when it is not built', () => {
    const r = byId(facts({ platform: 'darwin', isRoot: false }));
    expect(r.wifi).toMatchObject({ status: 'limited' });
    expect(r.bluetooth!.fix).toContain('pnpm setup:macos-helper');
    expect(r['host-scan']!.status).toBe('limited');
  });

  it('reports macOS wireless tools ok with the helper installed', () => {
    const r = byId(facts({ platform: 'darwin', macosHelperInstalled: true }));
    expect(r.wifi!.status).toBe('ok');
    expect(r.bluetooth!.status).toBe('ok');
  });

  it('marks Windows Bluetooth and host scan as unavailable', () => {
    const r = byId(facts({ platform: 'win32' }));
    expect(r.bluetooth!.status).toBe('unavailable');
    expect(r['host-scan']!.status).toBe('unavailable');
    expect(r.wifi!.status).toBe('limited');
  });
});

describe('formatDiagnosis', () => {
  it('prints why and fix lines only for problems', () => {
    const lines = formatDiagnosis(
      diagnosePlatform(facts({ has: (c) => c !== 'nmcli' })),
    );
    expect(lines.some((l) => l.includes('[FAIL]') && l.includes('WiFi'))).toBe(
      true,
    );
    expect(lines.filter((l) => l.includes('why:'))).toHaveLength(1);
    expect(lines.filter((l) => l.includes('fix:'))).toHaveLength(1);
  });
});
