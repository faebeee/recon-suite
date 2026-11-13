import { describe, expect, it } from 'vitest';
import {
  listHostScanInterfaces,
  parseIpAddrJson,
  parseArpScan,
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

describe('parseArpScan', () => {
  it('parses host lines and ignores banner/summary lines', () => {
    const text = [
      'Interface: eth0, type: EN10MB, MAC: aa:bb:cc:dd:ee:ff, IPv4: 192.168.1.5',
      'Starting arp-scan 1.9.7 with 256 hosts (https://github.com/royhills/arp-scan)',
      '192.168.1.10\t11:22:33:44:55:66\tDell Inc.',
      '192.168.1.1\taa:bb:cc:11:22:33\t(Unknown)',
      '',
      '2 packets received by filter, 0 packets dropped by kernel',
      'Ending arp-scan 1.9.7: 256 hosts scanned in 1.234 seconds (207.46 hosts/sec). 2 responded',
    ].join('\n');

    expect(parseArpScan(text)).toEqual([
      { ip: '192.168.1.1', macAddress: 'aa:bb:cc:11:22:33', vendor: undefined },
      {
        ip: '192.168.1.10',
        macAddress: '11:22:33:44:55:66',
        vendor: 'Dell Inc.',
      },
    ]);
  });

  it('returns an empty list when nothing responded', () => {
    expect(parseArpScan('0 responded')).toEqual([]);
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
