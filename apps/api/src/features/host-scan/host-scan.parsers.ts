import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import type { HostScanHost, HostScanInterface } from '@recon/shared';

/**
 * Lists non-internal IPv4 interfaces with a known subnet (what `arp-scan --localnet` needs).
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

export const ARP_SCAN_ARGS = ['--localnet', '--retry=1', '--timeout=500'];

const HOST_LINE =
  /^(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f]{2}(?::[0-9a-f]{2}){5})(?:\s+(.*))?$/i;

/** Parses `arp-scan --localnet --interface=<iface>` output: "ip\tmac\tvendor" lines. */
export function parseArpScan(text: string): HostScanHost[] {
  const hosts: HostScanHost[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = HOST_LINE.exec(line);
    if (!m) continue;
    const [, ip, mac, vendor] = m as unknown as [
      string,
      string,
      string,
      string?,
    ];
    const v = vendor?.trim();
    hosts.push({
      ip,
      macAddress: mac.toLowerCase(),
      vendor: v && v !== '(Unknown)' ? v : undefined,
    });
  }
  return hosts.sort((a, b) => ipToNumber(a.ip) - ipToNumber(b.ip));
}

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}
