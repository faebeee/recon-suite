import { TOOL_IDS } from '@recon/shared';
import type { HostFacts } from './platform-diagnostics.js';
import { describeRuntime } from './tool-runtime.js';

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
  Object.fromEntries(describeRuntime(h).tools.map((t) => [t.id, t]));

describe('describeRuntime', () => {
  it('describes every tool', () => {
    expect(
      describeRuntime(facts())
        .tools.map((t) => t.id)
        .sort(),
    ).toEqual([...TOOL_IDS].sort());
  });

  it('runs everything on the host when the API runs natively', () => {
    const info = describeRuntime(facts());
    expect(info.api).toEqual({ location: 'host', platform: 'linux' });
    expect(info.tools.every((t) => t.location === 'host')).toBe(true);
    expect(info.tools.every((t) => t.via === undefined)).toBe(true);
  });

  it('moves only the nmap tools into the Kali container', () => {
    const kali = { container: 'recon-kali', cli: 'podman' } as const;
    const r = byId(facts({ inContainer: true, kali }));
    expect(r.nmap).toMatchObject({
      location: 'kali',
      via: 'podman exec recon-kali',
      engine: expect.stringContaining('nmap'),
    });
    expect(r['host-scan']!.location).toBe('kali');
    expect(r.dns!.location).toBe('container');
    expect(r.wifi!.location).toBe('container');
  });

  it('names third-party services and platform engines', () => {
    const r = byId(facts({ platform: 'darwin', macosHelperInstalled: true }));
    expect(r.subdomains!.services).toEqual(['crt.sh']);
    expect(r.ports!.services).toEqual([]);
    expect(r.wifi!.engine).toContain('CoreWLAN');
    expect(byId(facts()).wifi!.engine).toContain('nmcli');
  });

  it('carries the support status of the diagnosis', () => {
    const r = byId(facts({ apiKeys: { nvd: false, securityTrails: true } }));
    expect(r['cve-lookup']).toMatchObject({
      status: 'unavailable',
      fix: expect.stringContaining('NVD_API_KEY'),
    });
  });
});
