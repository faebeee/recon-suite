import { describe, expect, it } from 'vitest';
import {
  listHostScanInterfaces,
  parseIpAddrJson,
  hostScanRange,
  nmapDiscoveryArgs,
  parseNmapDiscovery,
  pickDefaultHostScanInterface,
} from './host-scan.parsers.js';

describe('listHostScanInterfaces', () => {
  it('keeps non-internal IPv4 interfaces with a cidr', () => {
    const interfaces = listHostScanInterfaces({
      lo: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '127.0.0.1/8',
        },
      ],
      eth0: [
        {
          address: '192.168.1.5',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: 'aa:bb:cc:dd:ee:ff',
          internal: false,
          cidr: '192.168.1.5/24',
        },
        {
          address: 'fe80::1',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6',
          mac: 'aa:bb:cc:dd:ee:ff',
          internal: false,
          cidr: 'fe80::1/64',
          scopeid: 0,
        },
      ],
    } as never);

    expect(interfaces).toEqual([
      {
        name: 'eth0',
        address: '192.168.1.5',
        netmask: '255.255.255.0',
        cidr: '192.168.1.5/24',
        macAddress: 'aa:bb:cc:dd:ee:ff',
      },
    ]);
  });
});

describe('pickDefaultHostScanInterface', () => {
  it('prefers an interface with a real MAC address', () => {
    const interfaces = [
      { name: 'docker0', address: '172.17.0.1', netmask: '', cidr: '' },
      {
        name: 'eth0',
        address: '192.168.1.5',
        netmask: '',
        cidr: '',
        macAddress: 'aa:bb:cc:dd:ee:ff',
      },
    ];
    expect(pickDefaultHostScanInterface(interfaces)).toBe('eth0');
  });

  it('falls back to the first interface', () => {
    const interfaces = [
      { name: 'docker0', address: '172.17.0.1', netmask: '', cidr: '' },
    ];
    expect(pickDefaultHostScanInterface(interfaces)).toBe('docker0');
  });
});

describe('hostScanRange', () => {
  it('scans subnets up to /22 whole', () => {
    expect(hostScanRange('192.168.1.5/24')).toEqual({
      range: '192.168.1.0/24',
    });
    expect(hostScanRange('10.0.5.9/22')).toEqual({ range: '10.0.4.0/22' });
  });

  it('limits larger subnets to the /24 around the interface address', () => {
    expect(hostScanRange('10.88.0.6/16')).toEqual({
      range: '10.88.0.0/24',
      limitedFrom: '10.88.0.0/16',
    });
  });

  it('rejects anything that is not an IPv4 CIDR', () => {
    expect(() => hostScanRange('fe80::1/64')).toThrow();
  });
});

describe('nmapDiscoveryArgs', () => {
  it('pins the interface and only does host discovery', () => {
    const args = nmapDiscoveryArgs('eth0', '10.88.0.0/24');
    expect(args).toContain('-sn');
    expect(args.slice(args.indexOf('-e'), args.indexOf('-e') + 2)).toEqual([
      '-e',
      'eth0',
    ]);
    expect(args.at(-1)).toBe('10.88.0.0/24');
  });
});

describe('parseNmapDiscovery', () => {
  it('lists hosts that are up with MAC and vendor, sorted by IP', () => {
    const xml = `<nmaprun>
<host><status state="up" reason="arp-response" reason_ttl="0"/>
<address addr="10.88.0.7" addrtype="ipv4"/>
<address addr="DA:C3:1F:97:D0:AF" addrtype="mac"/>
<hostnames></hostnames></host>
<host><status state="up" reason="arp-response" reason_ttl="0"/>
<address addr="10.88.0.1" addrtype="ipv4"/>
<address addr="00:1A:2B:3C:4D:5E" addrtype="mac" vendor="Ayecom Technology &amp; Co"/>
</host>
<host><status state="down" reason="no-response"/><address addr="10.88.0.9" addrtype="ipv4"/></host>
<host><status state="up" reason="syn-ack"/><address addr="10.88.0.20" addrtype="ipv4"/></host>
</nmaprun>`;
    expect(parseNmapDiscovery(xml)).toEqual([
      {
        ip: '10.88.0.1',
        macAddress: '00:1a:2b:3c:4d:5e',
        vendor: 'Ayecom Technology & Co',
      },
      { ip: '10.88.0.7', macAddress: 'da:c3:1f:97:d0:af', vendor: undefined },
      { ip: '10.88.0.20', macAddress: undefined, vendor: undefined },
    ]);
  });

  it('returns an empty list when nothing is up', () => {
    expect(parseNmapDiscovery('<nmaprun></nmaprun>')).toEqual([]);
  });
});

describe('parseIpAddrJson', () => {
  it('lists non-loopback IPv4 interfaces from ip -j output', () => {
    const json = JSON.stringify([
      {
        ifname: 'lo',
        flags: ['LOOPBACK', 'UP'],
        link_type: 'loopback',
        address: '00:00:00:00:00:00',
        addr_info: [{ family: 'inet', local: '127.0.0.1', prefixlen: 8 }],
      },
      {
        ifname: 'eth0@if12',
        flags: ['BROADCAST', 'UP'],
        link_type: 'ether',
        address: 'AA:BB:CC:DD:EE:FF',
        addr_info: [{ family: 'inet', local: '10.89.0.4', prefixlen: 24 }],
      },
      {
        ifname: 'wg0',
        flags: ['POINTOPOINT', 'UP'],
        link_type: 'none',
        addr_info: [{ family: 'inet', local: '10.8.0.2', prefixlen: 32 }],
      },
    ]);
    expect(parseIpAddrJson(json)).toEqual([
      {
        name: 'eth0',
        address: '10.89.0.4',
        netmask: '255.255.255.0',
        cidr: '10.89.0.4/24',
        macAddress: 'aa:bb:cc:dd:ee:ff',
      },
      {
        name: 'wg0',
        address: '10.8.0.2',
        netmask: '255.255.255.255',
        cidr: '10.8.0.2/32',
        macAddress: undefined,
      },
    ]);
  });

  it('returns an empty list for invalid JSON', () => {
    expect(parseIpAddrJson('nope')).toEqual([]);
  });
});
