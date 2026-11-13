import type { NetworkInterfaceInfo } from 'node:os';
import {
  internetStatus,
  mapInterfaces,
  parseIpRouteJson,
  parseMacRoute,
  parseTrace,
  parseVmStatAvailable,
} from './host-stats.parser.js';

const info = (
  p: Partial<NetworkInterfaceInfo> & { address: string },
): NetworkInterfaceInfo =>
  ({
    netmask: '255.255.255.0',
    family: 'IPv4',
    mac: '00:00:00:00:00:00',
    internal: false,
    cidr: `${p.address}/24`,
    ...p,
  }) as NetworkInterfaceInfo;

describe('mapInterfaces', () => {
  it('drops loopback and link-local-only interfaces, puts the default first', () => {
    const out = mapInterfaces(
      {
        lo0: [info({ address: '127.0.0.1', internal: true })],
        en1: [info({ address: '10.0.0.5', mac: 'AA:BB:CC:00:11:22' })],
        en0: [
          info({ address: '192.168.1.20', mac: 'aa:bb:cc:dd:ee:ff' }),
          info({
            address: 'fe80::1',
            family: 'IPv6',
            cidr: 'fe80::1/64',
            mac: 'aa:bb:cc:dd:ee:ff',
          }),
        ],
        utun0: [info({ address: 'fe80::2', family: 'IPv6', cidr: undefined })],
      },
      'en0',
    );
    expect(out.map((i) => i.name)).toEqual(['en0', 'en1']);
    expect(out[0]).toEqual({
      name: 'en0',
      mac: 'aa:bb:cc:dd:ee:ff',
      isDefault: true,
      addresses: [
        { address: '192.168.1.20', family: 4, cidr: '192.168.1.20/24' },
        { address: 'fe80::1', family: 6, cidr: 'fe80::1/64' },
      ],
    });
    expect(out[1]!.mac).toBe('aa:bb:cc:00:11:22');
  });

  it('keeps a link-local-only interface when it is the default, without a fake MAC', () => {
    const out = mapInterfaces(
      {
        utun0: [info({ address: 'fe80::2', family: 'IPv6', cidr: undefined })],
      },
      'utun0',
    );
    expect(out).toEqual([
      {
        name: 'utun0',
        mac: undefined,
        isDefault: true,
        addresses: [{ address: 'fe80::2', family: 6, cidr: 'fe80::2' }],
      },
    ]);
  });
});

describe('default gateway parsers', () => {
  it('parses macOS route output', () => {
    const text = `   route to: default
destination: default
       mask: default
    gateway: 192.168.1.1
  interface: en0
      flags: <UP,GATEWAY,DONE,STATIC,PRCLONING,GLOBAL>`;
    expect(parseMacRoute(text)).toEqual({
      address: '192.168.1.1',
      interface: 'en0',
    });
    expect(
      parseMacRoute('route: writing to routing socket: not in table'),
    ).toBeUndefined();
  });

  it('parses Linux ip -j route output', () => {
    expect(
      parseIpRouteJson(
        '[{"dst":"default","gateway":"172.17.0.1","dev":"eth0","flags":[]}]',
      ),
    ).toEqual({ address: '172.17.0.1', interface: 'eth0' });
    expect(parseIpRouteJson('[]')).toBeUndefined();
    expect(parseIpRouteJson('not json')).toBeUndefined();
  });
});

describe('parseTrace', () => {
  it('reads key=value lines', () => {
    expect(
      parseTrace('fl=1\nh=1.1.1.1\nip=203.0.113.7\nloc=CH\ncolo=ZRH\n'),
    ).toMatchObject({ ip: '203.0.113.7', loc: 'CH', colo: 'ZRH' });
  });
});

describe('parseVmStatAvailable', () => {
  it('adds free, inactive and speculative pages', () => {
    const text = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                     7519.
Pages active:                                 187145.
Pages inactive:                               186537.
Pages speculative:                              1187.
Pages wired down:                             212483.`;
    expect(parseVmStatAvailable(text)).toBe((7519 + 186537 + 1187) * 16384);
  });

  it('returns undefined for unexpected output', () => {
    expect(parseVmStatAvailable('nope')).toBeUndefined();
    expect(
      parseVmStatAvailable('(page size of 4096 bytes)\nPages free: 1.'),
    ).toBeUndefined();
  });
});

describe('internetStatus', () => {
  it('combines the DNS and HTTPS checks', () => {
    expect(internetStatus({ ok: true }, { ok: true })).toBe('online');
    expect(internetStatus({ ok: false }, { ok: true })).toBe('degraded');
    expect(internetStatus({ ok: false }, { ok: false })).toBe('offline');
  });
});
