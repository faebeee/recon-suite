import type { RuntimeInfo, ToolId, ToolRuntime } from '@recon/shared';
import { diagnosePlatform, type HostFacts } from './platform-diagnostics.js';

interface Engine {
  engine: string;
  services?: string[];
}

const NODE_DNS = 'Node.js DNS resolver';
const NODE_HTTP = 'Node.js HTTP client (undici)';
const NODE_SOCKETS = 'Node.js net/tls sockets';

/**
 * What does the work for each tool. One entry per tool: a new ToolId without one fails the
 * typecheck. Keep in sync with the services when an implementation changes.
 */
const ENGINES: Record<ToolId, (h: HostFacts) => Engine> = {
  dns: () => ({ engine: NODE_DNS }),
  whois: () => ({ engine: 'RDAP over HTTPS', services: ['rdap.org'] }),
  subdomains: () => ({
    engine: 'Certificate Transparency search',
    services: ['crt.sh'],
  }),
  'email-security': () => ({ engine: NODE_DNS }),
  'zone-transfer': () => ({ engine: `AXFR over TCP (${NODE_SOCKETS})` }),
  dnssec: () => ({
    engine: 'DNS-over-HTTPS',
    services: ['cloudflare-dns.com'],
  }),
  takeover: () => ({
    engine: `${NODE_DNS} + HTTP fingerprints`,
    services: ['crt.sh'],
  }),
  'ip-intel': () => ({ engine: `${NODE_DNS} + RDAP`, services: ['rdap.org'] }),
  'dev-footprint': () => ({
    engine: 'Public platform APIs',
    services: [
      'api.github.com',
      'gitlab.com',
      'registry.npmjs.org',
      'pypi.org',
      'hub.docker.com',
    ],
  }),
  'passive-exposure': () => ({
    engine: 'Shodan InternetDB',
    services: ['internetdb.shodan.io'],
  }),
  'cve-lookup': () => ({
    engine: 'NVD CVE API',
    services: ['services.nvd.nist.gov'],
  }),
  'cert-search': () => ({
    engine: 'Certificate Transparency search',
    services: ['crt.sh'],
  }),
  'reverse-ip': () => ({
    engine: 'SecurityTrails API',
    services: ['api.securitytrails.com'],
  }),
  'cloud-storage': () => ({
    engine: NODE_HTTP,
    services: ['S3', 'Google Cloud Storage', 'Azure Blob Storage'],
  }),
  'http-headers': () => ({ engine: NODE_HTTP }),
  tls: () => ({ engine: NODE_SOCKETS }),
  'web-files': () => ({ engine: NODE_HTTP }),
  'tech-fingerprint': () => ({ engine: NODE_HTTP }),
  wayback: () => ({
    engine: 'Wayback CDX API',
    services: ['web.archive.org'],
  }),
  cors: () => ({ engine: NODE_HTTP }),
  'cookie-audit': () => ({ engine: NODE_HTTP }),
  'waf-detect': () => ({ engine: NODE_HTTP }),
  'favicon-hash': () => ({ engine: NODE_HTTP }),
  'api-discovery': () => ({ engine: NODE_HTTP }),
  dnsbl: () => ({
    engine: 'DNS (host resolver)',
    services: [
      'Spamhaus',
      'SpamCop',
      'Barracuda',
      'PSBL',
      'UCEPROTECT',
      'SURBL',
    ],
  }),
  'http-methods': () => ({ engine: NODE_HTTP, services: ['hstspreload.org'] }),
  'tls-audit': () => ({ engine: NODE_SOCKETS }),
  'js-endpoints': () => ({ engine: NODE_HTTP }),
  'exposed-files': () => ({ engine: NODE_HTTP }),
  ports: () => ({ engine: `TCP connect (${NODE_SOCKETS})` }),
  'banner-grab': () => ({ engine: NODE_SOCKETS }),
  nmap: () => ({ engine: 'nmap (-sT, -sV)' }),
  'network-scan': () => ({ engine: 'nmap -sn (ping sweep)' }),
  'host-scan': () => ({ engine: 'nmap -sn (host sweep)' }),
  wifi: (h) => {
    switch (h.platform) {
      case 'darwin':
        return {
          engine: h.macosHelperInstalled
            ? 'ReconHelper (CoreWLAN)'
            : 'system_profiler (names redacted)',
        };
      case 'linux':
        return { engine: 'nmcli (NetworkManager)' };
      case 'win32':
        return { engine: 'netsh wlan' };
      default:
        return { engine: 'not supported' };
    }
  },
  bluetooth: (h) => {
    switch (h.platform) {
      case 'darwin':
        return {
          engine: h.macosHelperInstalled
            ? 'ReconHelper (CoreBluetooth + IOBluetooth)'
            : 'system_profiler (paired devices only)',
        };
      case 'linux':
        return { engine: 'bluetoothctl (BlueZ)' };
      default:
        return { engine: 'not implemented' };
    }
  },
};

/** Where and with what every tool runs on this setup, plus its support status. */
export function describeRuntime(h: HostFacts): RuntimeInfo {
  const apiLocation = h.inContainer ? 'container' : 'host';
  const tools: ToolRuntime[] = diagnosePlatform(h).map((support) => {
    const { engine, services = [] } = ENGINES[support.id](h);
    return { ...support, location: apiLocation, engine, services };
  });
  return {
    api: { location: apiLocation, platform: h.platform },
    tools,
  };
}
