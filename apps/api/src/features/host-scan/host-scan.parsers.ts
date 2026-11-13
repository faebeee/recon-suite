import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import type { HostScanHost, HostScanInterface } from '@recon/shared';
import { xmlAttrs } from '../../core/util/xml-attrs.js';

/**
 * Lists non-internal IPv4 interfaces with a known subnet (the subnet nmap sweeps).
 * Pure wrapper around `os.networkInterfaces()` so it can be unit-tested with fixtures.
 */
export function listHostScanInterfaces(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): HostScanInterface[] {
  const result: HostScanInterface[] = [];
  for (const [name, infos] of Object.entries(interfaces)) {
    for (const info of infos ?? []) {
      if (info.internal || info.family !== 'IPv4' || !info.cidr) continue;
      result.push({
        name,
        address: info.address,
        netmask: info.netmask,
        cidr: info.cidr,
        macAddress:
          info.mac && info.mac !== '00:00:00:00:00:00' ? info.mac : undefined,
      });
    }
  }
  return result;
}

interface IpAddrEntry {
  ifname?: unknown;
  address?: unknown;
  link_type?: unknown;
  flags?: unknown;
  addr_info?: { family?: unknown; local?: unknown; prefixlen?: unknown }[];
}

/**
 * Parses `ip -j addr show` (iproute2 JSON), used when interfaces live in the Kali
 * container instead of the API process. Same filter as listHostScanInterfaces().
 */
export function parseIpAddrJson(text: string): HostScanInterface[] {
  let entries: unknown;
  try {
    entries = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(entries)) return [];
  const result: HostScanInterface[] = [];
  for (const entry of entries as IpAddrEntry[]) {
    if (typeof entry?.ifname !== 'string') continue;
    const loopback =
      entry.link_type === 'loopback' ||
      (Array.isArray(entry.flags) && entry.flags.includes('LOOPBACK'));
    if (loopback) continue;
    const mac =
      typeof entry.address === 'string' &&
      /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(entry.address) &&
      entry.address !== '00:00:00:00:00:00'
        ? entry.address.toLowerCase()
        : undefined;
    for (const info of entry.addr_info ?? []) {
      if (
        info.family !== 'inet' ||
        typeof info.local !== 'string' ||
        typeof info.prefixlen !== 'number'
      ) {
        continue;
      }
      result.push({
        name: entry.ifname.split('@')[0]!,
        address: info.local,
        netmask: prefixToNetmask(info.prefixlen),
        cidr: `${info.local}/${info.prefixlen}`,
        macAddress: mac,
      });
    }
  }
  return result;
}

function prefixToNetmask(prefix: number): string {
  const bits =
    prefix <= 0 ? 0 : (0xffffffff << (32 - Math.min(prefix, 32))) >>> 0;
  return [24, 16, 8, 0].map((shift) => (bits >>> shift) & 0xff).join('.');
}

/** Prefers an interface with a real (non-zero) MAC address over virtual/tunnel ones. */
export function pickDefaultHostScanInterface(
  interfaces: HostScanInterface[],
): string | undefined {
  return (interfaces.find((i) => i.macAddress) ?? interfaces[0])?.name;
}

/** Larger subnets are not swept whole: a /16 takes minutes. */
export const MAX_SCAN_PREFIX = 22;
/** What is swept instead when the interface subnet is larger than MAX_SCAN_PREFIX. */
export const FALLBACK_PREFIX = 24;

/**
 * Range to sweep for an interface CIDR (e.g. "10.88.0.6/16"). Subnets up to /22 (1024
 * addresses) are scanned whole; larger ones only as the /24 around the interface address,
 * with `limitedFrom` naming the full subnet.
 */
export function hostScanRange(cidr: string): {
  range: string;
  limitedFrom?: string;
} {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(cidr);
  if (!m) throw new Error(`Invalid IPv4 CIDR "${cidr}"`);
  const ip = ipToNumber(m[1]!);
  const prefix = Number(m[2]);
  if (prefix >= MAX_SCAN_PREFIX) {
    return { range: `${numberToIp(networkOf(ip, prefix))}/${prefix}` };
  }
  return {
    range: `${numberToIp(networkOf(ip, FALLBACK_PREFIX))}/${FALLBACK_PREFIX}`,
    limitedFrom: `${numberToIp(networkOf(ip, prefix))}/${prefix}`,
  };
}

/**
 * nmap host discovery without port scan. As root on a local Ethernet segment nmap uses ARP
 * (and reports MAC + vendor); unprivileged it falls back to TCP connect probes (no MAC).
 * `-e` pins the interface; the range comes from the OS-reported interface, never from input.
 */
export function nmapDiscoveryArgs(iface: string, range: string): string[] {
  return [
    '-sn',
    '-n',
    '-T4',
    '--max-retries',
    '1',
    '-e',
    iface,
    '-oX',
    '-',
    range,
  ];
}

/** Parses `nmap -sn -oX -`: hosts that are up, with MAC address and vendor when known. */
export function parseNmapDiscovery(xml: string): HostScanHost[] {
  const hosts: HostScanHost[] = [];
  for (const m of xml.matchAll(/<host\b[^>]*>([\s\S]*?)<\/host>/g)) {
    const body = m[1] ?? '';
    const status = xmlAttrs(/<status\b([^>]*?)\/?>/.exec(body)?.[1]);
    if (status.state !== 'up') continue;
    let ip: string | undefined;
    let mac: Record<string, string | undefined> | undefined;
    for (const a of body.matchAll(/<address\b([^>]*?)\/?>/g)) {
      const attrs = xmlAttrs(a[1]);
      if (attrs.addrtype === 'ipv4') ip = attrs.addr;
      else if (attrs.addrtype === 'mac') mac = attrs;
    }
    if (!ip) continue;
    hosts.push({
      ip,
      macAddress: mac?.addr?.toLowerCase(),
      vendor: mac?.vendor || undefined,
    });
  }
  return hosts.sort((a, b) => ipToNumber(a.ip) - ipToNumber(b.ip));
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

function numberToIp(n: number): string {
  return [24, 16, 8, 0].map((shift) => (n >>> shift) & 0xff).join('.');
}

function networkOf(ip: number, prefix: number): number {
  const mask = prefix <= 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) >>> 0;
}
