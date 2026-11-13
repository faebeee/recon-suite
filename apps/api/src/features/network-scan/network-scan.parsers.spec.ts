import { describe, expect, it } from 'vitest';
import {
  guessDeviceType,
  networkScanArgs,
  networkScanFindings,
  parseCidr,
  parseNetworkScan,
} from './network-scan.parsers.js';

describe('parseCidr', () => {
  it('clears host bits', () => {
    expect(parseCidr('192.168.1.5/24')).toEqual({
      network: '192.168.1.0',
      prefix: 24,
    });
    expect(parseCidr('10.0.5.9/22')).toEqual({
      network: '10.0.4.0',
      prefix: 22,
    });
  });

  it('treats a /32 as a single host', () => {
    expect(parseCidr('10.0.0.5/32')).toEqual({
      network: '10.0.0.5',
      prefix: 32,
    });
  });

  it('rejects malformed input', () => {
    expect(() => parseCidr('not-a-cidr')).toThrow();
    expect(() => parseCidr('fe80::1/64')).toThrow();
  });
});

describe('networkScanArgs', () => {
  it('builds a ping-sweep-only command', () => {
    const args = networkScanArgs('192.168.1.0/24');
    expect(args).toContain('-sn');
    expect(args).not.toContain('-e');
    expect(args.at(-1)).toBe('192.168.1.0/24');
  });

  it('forces IP-level probes to avoid proxy-ARP false positives', () => {
    const args = networkScanArgs('192.168.1.0/24');
    expect(args).toContain('--send-ip');
    expect(args).toContain('-PE');
    expect(args.some((a) => a.startsWith('-PS'))).toBe(true);
    expect(args.some((a) => a.startsWith('-PA'))).toBe(true);
    expect(args.some((a) => a.startsWith('-PU'))).toBe(true);
  });
});

describe('parseNetworkScan', () => {
  it('lists hosts that are up with MAC, vendor and a device guess, sorted by IP', () => {
    const xml = `<nmaprun>
<host><status state="up" reason="arp-response" reason_ttl="0"/>
<address addr="10.88.0.7" addrtype="ipv4"/>
<address addr="DA:C3:1F:97:D0:AF" addrtype="mac" vendor="Apple, Inc."/>
<hostnames></hostnames></host>
<host><status state="up" reason="arp-response" reason_ttl="0"/>
<address addr="10.88.0.1" addrtype="ipv4"/>
<address addr="00:1A:2B:3C:4D:5E" addrtype="mac" vendor="Ayecom Technology &amp; Co"/>
</host>
<host><status state="down" reason="no-response"/><address addr="10.88.0.9" addrtype="ipv4"/></host>
<host><status state="up" reason="syn-ack"/><address addr="10.88.0.20" addrtype="ipv4"/></host>
</nmaprun>`;
    expect(parseNetworkScan(xml)).toEqual([
      {
        ip: '10.88.0.1',
        macAddress: '00:1a:2b:3c:4d:5e',
        vendor: 'Ayecom Technology & Co',
      },
      {
        ip: '10.88.0.7',
        macAddress: 'da:c3:1f:97:d0:af',
        vendor: 'Apple, Inc.',
        deviceGuess: 'Apple device',
      },
      { ip: '10.88.0.20', macAddress: undefined, vendor: undefined },
    ]);
  });

  it('returns an empty list when nothing is up', () => {
    expect(parseNetworkScan('<nmaprun></nmaprun>')).toEqual([]);
  });
});

describe('guessDeviceType', () => {
  it('maps known vendor keywords to a device category', () => {
    expect(guessDeviceType('Raspberry Pi Foundation')).toBe('Raspberry Pi');
    expect(guessDeviceType('Apple, Inc.')).toBe('Apple device');
    expect(guessDeviceType('TP-Link Technologies Co., Ltd.')).toBe(
      'Router / access point / networking gear',
    );
    expect(guessDeviceType('Hewlett Packard')).toBe('Printer');
    expect(guessDeviceType('VMware, Inc.')).toBe('Virtual machine');
    expect(guessDeviceType('Espressif Inc.')).toBe(
      'IoT device (ESP32/ESP8266)',
    );
  });

  it('returns undefined for unknown or missing vendors', () => {
    expect(guessDeviceType(undefined)).toBeUndefined();
    expect(guessDeviceType('Some Random Vendor Co')).toBeUndefined();
  });
});

describe('networkScanFindings', () => {
  it('summarises the hosts that responded', () => {
    const f = networkScanFindings('10.0.0.0/24', [
      { ip: '10.0.0.1' },
      { ip: '10.0.0.2', macAddress: 'aa:bb:cc:dd:ee:ff' },
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ status: 'info', value: '10.0.0.1, 10.0.0.2' });
  });

  it('reports when nothing responded', () => {
    const f = networkScanFindings('10.0.0.0/24', []);
    expect(f[0]!.title).toMatch(/No hosts responded/);
    expect(f[0]!.value).toBeUndefined();
  });
});
