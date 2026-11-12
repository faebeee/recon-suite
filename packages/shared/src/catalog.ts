import type { ToolCategory, ToolId, ToolMeta } from './common/tool.js';

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  dns: 'DNS',
  intel: 'Intel',
  web: 'Web',
  network: 'Network',
  wireless: 'Wireless',
};

/** Single source of truth for tool metadata (used by API and web). */
export const TOOL_CATALOG: Record<ToolId, ToolMeta> = {
  dns: {
    id: 'dns',
    code: 'D-01',
    name: 'DNS Recon',
    tagline: 'Resolve every record type',
    description:
      'Queries A, AAAA, CNAME, MX, NS, TXT, SOA and CAA records through a chosen resolver.',
    category: 'dns',
    mode: 'passive',
    scope: 'remote',
    targetHint: 'example.com',
  },
  subdomains: {
    id: 'subdomains',
    code: 'D-02',
    name: 'Subdomain Finder',
    tagline: 'Mine certificate transparency logs',
    description:
      'Enumerates subdomains from public certificate transparency logs (crt.sh).',
    category: 'dns',
    mode: 'passive',
    scope: 'remote',
    targetHint: 'example.com',
  },
  whois: {
    id: 'whois',
    code: 'I-01',
    name: 'WHOIS / RDAP',
    tagline: 'Registration intel',
    description:
      'Looks up registrar, lifecycle dates, status and nameservers for domains, or network ownership for IPs, via RDAP.',
    category: 'intel',
    mode: 'passive',
    scope: 'remote',
    targetHint: 'example.com or 1.1.1.1',
  },
  'http-headers': {
    id: 'http-headers',
    code: 'W-01',
    name: 'HTTP Inspector',
    tagline: 'Headers, redirects, security grade',
    description:
      'Follows the redirect chain, captures response headers and grades security headers.',
    category: 'web',
    mode: 'active',
    scope: 'remote',
    targetHint: 'https://example.com',
  },
  tls: {
    id: 'tls',
    code: 'W-02',
    name: 'TLS Inspector',
    tagline: 'Certificate and handshake',
    description:
      'Performs a TLS handshake and reports protocol, cipher, certificate chain, SANs and expiry.',
    category: 'web',
    mode: 'active',
    scope: 'remote',
    targetHint: 'example.com',
  },
  ports: {
    id: 'ports',
    code: 'N-01',
    name: 'Port Probe',
    tagline: 'TCP connect check',
    description:
      'Checks a short list of common TCP ports for open, closed or filtered state.',
    category: 'network',
    mode: 'active',
    scope: 'remote',
    targetHint: 'example.com',
  },
  'host-scan': {
    id: 'host-scan',
    code: 'N-02',
    name: 'Host Scan',
    tagline: 'ARP-discover hosts on the local network',
    description:
      "Sends ARP requests over the API host's chosen network interface to discover live hosts and MAC addresses on its local subnet.",
    category: 'network',
    mode: 'active',
    scope: 'local',
    targetHint: '',
  },
  wifi: {
    id: 'wifi',
    code: 'R-01',
    name: 'WiFi Scanner',
    tagline: 'Nearby wireless networks',
    description:
      'Lists the WiFi networks visible to the machine running the API: SSID, band, channel, security and signal.',
    category: 'wireless',
    mode: 'passive',
    scope: 'local',
    targetHint: '',
  },
  bluetooth: {
    id: 'bluetooth',
    code: 'R-02',
    name: 'Bluetooth Scanner',
    tagline: 'BLE and Classic devices nearby',
    description:
      'Listens for Bluetooth Low Energy advertisements and runs a Bluetooth Classic inquiry from the machine running the API.',
    category: 'wireless',
    mode: 'passive',
    scope: 'local',
    targetHint: '',
  },
};

export const TOOL_LIST: ToolMeta[] = Object.values(TOOL_CATALOG);
