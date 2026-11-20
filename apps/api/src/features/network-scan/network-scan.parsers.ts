import type { Finding, NetworkScanHost } from '@recon/shared';
import { xmlAttrs } from '../../core/util/xml-attrs.js';

const CIDR_RE = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/;

export interface ParsedCidr {
  /** Network address of the range (host bits cleared). */
  network: string;
  prefix: number;
}

/** Parses and normalises an IPv4 CIDR, clearing any host bits ("10.0.0.5/24" -> "10.0.0.0/24"). */
export function parseCidr(cidr: string): ParsedCidr {
  const m = CIDR_RE.exec(cidr);
  if (!m) throw new Error(`Invalid IPv4 CIDR "${cidr}"`);
  const ip = ipToNumber(m[1]!);
  const prefix = Number(m[2]);
  return { network: numberToIp(networkOf(ip, prefix)), prefix };
}

/**
 * Host discovery without a port scan. `--send-ip` forces Nmap to probe at the IP level
 * (ICMP/TCP) instead of its default ARP ping on local Ethernet segments: many routers/APs
 * answer ARP requests on behalf of every address in the subnet (proxy ARP), which otherwise
 * makes Nmap report every address as "up" regardless of whether a real host is there.
 * `-PE` (ICMP echo), `-PS` (TCP SYN to common ports) and `-PU` (UDP to a closed port) are
 * combined so a host that only answers one probe type (ICMP blocked, or vice versa) is still
 * found. No `-PA`: a TCP ACK probe can only ever be answered with an RST, which is not proof
 * of a live host (see LIVE_HOST_REASONS). The range comes from the caller, already validated
 * and bounded.
 */
export function networkScanArgs(range: string): string[] {
  return ['-sn', range];
}

/**
 * nmap `<status reason>` values that only a real, online host produces. nmap also marks a host
 * "up" on a TCP RST (`reset`), but RSTs are routinely generated on behalf of every address in a
 * range by NAT layers (VM and VPN network stacks), stateful firewalls and gateways, which made every address appear online.
 * `arp-response` is excluded for the same reason (proxy ARP); `--send-ip` avoids it anyway.
 */
export const LIVE_HOST_REASONS: ReadonlySet<string> = new Set([
  'echo-reply',
  'timestamp-reply',
  'addressmask-reply',
  'syn-ack',
  'udp-response',
  'port-unreach',
  'proto-unreach',
  'localhost-response',
]);

/**
 * Parses `nmap -sn -oX -`: hosts that are up and answered with a response that proves a
 * live host (LIVE_HOST_REASONS). MAC address and vendor are only present when
 * Nmap could resolve them from its own ARP cache (same Ethernet segment); `--send-ip`
 * (see networkScanArgs) means this is the exception rather than the rule.
 */
export function parseNetworkScan(xml: string): NetworkScanHost[] {
  const hosts: NetworkScanHost[] = [];
  for (const m of xml.matchAll(/<host\b[^>]*>([\s\S]*?)<\/host>/g)) {
    const body = m[1] ?? '';
    const status = xmlAttrs(/<status\b([^>]*?)\/?>/.exec(body)?.[1]);
    if (status.state !== 'up' || !LIVE_HOST_REASONS.has(status.reason ?? ''))
      continue;
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
      deviceGuess: guessDeviceType(mac?.vendor),
    });
  }
  return hosts.sort((a, b) => ipToNumber(a.ip) - ipToNumber(b.ip));
}

/**
 * Best-effort device category from the MAC vendor's OUI name (nmap's built-in database).
 * Pure keyword matching on the vendor string; always a guess, never shown as a fact.
 */
const DEVICE_RULES: [RegExp, string][] = [
  [/raspberry pi/i, 'Raspberry Pi'],
  [/apple/i, 'Apple device'],
  [/samsung electro.*mobile|samsung electronics co/i, 'Samsung device'],
  [/huawei/i, 'Huawei device'],
  [/xiaomi/i, 'Xiaomi device'],
  [/google/i, 'Google/Nest device'],
  [/amazon/i, 'Amazon device'],
  [/sonos/i, 'Sonos speaker'],
  [/roku/i, 'Roku streaming device'],
  [/espressif/i, 'IoT device (ESP32/ESP8266)'],
  [/sonoff|tuya|shelly/i, 'Smart-home / IoT device'],
  [/hewlett.?packard|canon|brother|epson|lexmark|xerox/i, 'Printer'],
  [
    /ubiquiti|tp-link|netgear|d-link|linksys|asustek|technicolor|arris|mikrotik|cisco|aruba|ruckus|zyxel/i,
    'Router / access point / networking gear',
  ],
  [
    /vmware|virtualbox|parallels|microsoft hyper-v|qemu|xen/i,
    'Virtual machine',
  ],
  [
    /intel corporate|realtek|dell|lenovo|hewlett packard enterprise/i,
    'Computer',
  ],
  [/espr|nest labs|ring/i, 'Smart-home device'],
];

export function guessDeviceType(vendor?: string): string | undefined {
  if (!vendor) return undefined;
  for (const [re, label] of DEVICE_RULES) {
    if (re.test(vendor)) return label;
  }
  return undefined;
}

/** One info finding summarising what was found, for engagement history. */
export function networkScanFindings(
  network: string,
  hosts: NetworkScanHost[],
): Finding[] {
  return [
    {
      id: 'network-scan.hosts',
      status: 'info',
      title: hosts.length
        ? `${hosts.length} host${hosts.length === 1 ? '' : 's'} up on ${network}`
        : `No hosts responded on ${network}`,
      message: hosts.length
        ? 'Hosts that answered the ping sweep.'
        : 'No host answered the ICMP/TCP/UDP probes in this range.',
      value: hosts.map((h) => h.ip).join(', ') || undefined,
    },
  ];
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
