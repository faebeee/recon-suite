import { TOOL_CATALOG, type SupportStatus, type ToolId } from '@recon/shared';

export type { SupportStatus };

export interface ToolSupport {
  id: ToolId;
  status: SupportStatus;
  /** Why the tool is limited/unavailable (human readable). */
  reason?: string;
  /** What to install or change to fix it. */
  fix?: string;
}

/** Facts about the host, gathered once at boot. Injected so the logic stays pure. */
export interface HostFacts {
  platform: NodeJS.Platform;
  /** Is a command available on PATH? */
  has: (command: string) => boolean;
  macosHelperInstalled: boolean;
  isRoot: boolean;
  inContainer: boolean;
  hasIpv4Interface: boolean;
  /** Third-party API keys that are configured (env var names). */
  apiKeys: { nvd: boolean; securityTrails: boolean };
  /** Linux: NET_RAW is in the capability bounding set (always true elsewhere). */
  netRawAllowed: boolean;
}

const OK = { status: 'ok' } as const;
const CONTAINER_HINT =
  ' The API runs inside a container, which usually has no access to the host hardware; run it natively (`pnpm dev`) instead.';

type Check = (h: HostFacts) => Omit<ToolSupport, 'id'>;

/** One check per tool: a new ToolId without a check fails the typecheck. */
const CHECKS: Record<ToolId, Check> = {
  // Remote tools only need Node's networking (and outbound internet access).
  dns: () => OK,
  whois: () => OK,
  subdomains: () => OK,
  'email-security': () => OK,
  'ip-intel': () => OK,
  'passive-exposure': () => OK,
  'dev-footprint': () => OK,
  'http-headers': () => OK,
  tls: () => OK,
  'web-files': () => OK,
  'tech-fingerprint': () => OK,
  'zone-transfer': () => OK,
  dnssec: () => OK,
  takeover: () => OK,
  'cert-search': () => OK,
  'cloud-storage': () => OK,
  wayback: () => OK,
  cors: () => OK,
  'cookie-audit': () => OK,
  'waf-detect': () => OK,
  'favicon-hash': () => OK,
  'api-discovery': () => OK,
  dnsbl: () => OK,
  'http-methods': () => OK,
  'tls-audit': () => OK,
  'js-endpoints': () => OK,
  'exposed-files': () => OK,
  'banner-grab': () => OK,
  'cve-lookup': (h) =>
    h.apiKeys.nvd
      ? OK
      : {
          status: 'unavailable',
          reason: 'No NVD API key configured.',
          fix: 'Request a free key at https://nvd.nist.gov/developers/request-an-api-key and set NVD_API_KEY.',
        },
  'reverse-ip': (h) =>
    h.apiKeys.securityTrails
      ? OK
      : {
          status: 'unavailable',
          reason: 'No SecurityTrails API key configured.',
          fix: 'Create a key at https://securitytrails.com and set SECURITYTRAILS_API_KEY.',
        },
  ports: () => OK,

  nmap: (h) => {
    return h.has('nmap')
      ? OK
      : {
          status: 'unavailable',
          reason: '"nmap" is not installed on the API host.',
          fix:
            (h.platform === 'darwin'
              ? 'brew install nmap'
              : 'Install it, e.g. "sudo apt install nmap"') +
            ', or run the API with "pnpm compose:up" (its image is built on Kali).',
        };
  },

  'network-scan': (h) => {
    if (!h.has('nmap')) {
      return {
        status: 'unavailable',
        reason: '"nmap" is not installed on the API host.',
        fix:
          (h.platform === 'darwin'
            ? 'brew install nmap'
            : 'Install it, e.g. "sudo apt install nmap"') +
          ', or run the API with "pnpm compose:up" (its image is built on Kali).',
      };
    }
    if (!h.isRoot) {
      return {
        status: 'limited',
        reason:
          'Without root, nmap discovers hosts with TCP probes instead of ARP: no MAC addresses, and hosts with no open common port are missed.',
        fix: 'Run the API as root, or with "pnpm compose:up" (root inside its container).',
      };
    }
    return OK;
  },

  'host-scan': (h) => {
    if (h.platform === 'win32') {
      return {
        status: 'unavailable',
        reason: 'Host Scan is not supported on Windows.',
        fix: 'Run the API on Linux or macOS, or with "pnpm compose:up".',
      };
    }
    if (!h.has('nmap')) {
      return {
        status: 'unavailable',
        reason: '"nmap" is not installed.',
        fix:
          (h.platform === 'darwin'
            ? 'brew install nmap'
            : 'Install it, e.g. "sudo apt install nmap"') +
          ', or run the API with "pnpm compose:up" (its image is built on Kali).',
      };
    }
    if (!h.hasIpv4Interface) {
      return {
        status: 'unavailable',
        reason: 'No non-loopback IPv4 network interface found.',
        fix: 'Connect the host to a network.',
      };
    }
    if (!h.isRoot) {
      return {
        status: 'limited',
        reason:
          'Without root, nmap discovers hosts with TCP probes instead of ARP: no MAC addresses, and hosts with no open common port are missed.',
        fix: 'Run the API as root, or with "pnpm compose:up" (root inside its container).',
      };
    }
    if (!h.netRawAllowed) {
      return {
        status: 'unavailable',
        reason:
          'The process may not open raw sockets: NET_RAW is missing from its capability bounding set.',
        fix: h.inContainer
          ? 'Start the container with the NET_RAW capability (compose: cap_add: [NET_RAW], podman/docker: --cap-add NET_RAW).'
          : 'Run the API without dropping the NET_RAW capability.',
      };
    }
    return OK;
  },

  wifi: (h) => {
    switch (h.platform) {
      case 'darwin':
        if (!h.has('networksetup') || !h.has('system_profiler')) {
          return {
            status: 'unavailable',
            reason: '"networksetup" or "system_profiler" is missing from PATH.',
            fix: 'Make sure /usr/sbin is on PATH.',
          };
        }
        return h.macosHelperInstalled
          ? OK
          : {
              status: 'limited',
              reason:
                'ReconHelper is not built: macOS redacts WiFi names and BSSIDs without Location permission.',
              fix: 'pnpm setup:macos-helper (then click "Allow" for Location access)',
            };
      case 'linux':
        return h.has('nmcli')
          ? OK
          : {
              status: 'unavailable',
              reason:
                '"nmcli" (NetworkManager) is not installed.' + containerHint(h),
              fix: 'Install NetworkManager, e.g. "sudo apt install network-manager".',
            };
      case 'win32':
        return h.has('netsh')
          ? {
              status: 'limited',
              reason:
                'Windows 11 24H2+ only lists networks when Location access is allowed for desktop apps.',
              fix: 'Settings > Privacy & security > Location: allow desktop apps.',
            }
          : {
              status: 'unavailable',
              reason: '"netsh" is missing from PATH.',
              fix: 'Make sure C:\\Windows\\System32 is on PATH.',
            };
      default:
        return unsupportedPlatform(h, 'WiFi scanning');
    }
  },

  bluetooth: (h) => {
    switch (h.platform) {
      case 'darwin':
        return h.macosHelperInstalled
          ? OK
          : {
              status: 'limited',
              reason:
                'ReconHelper is not built: without Bluetooth permission only paired devices are listed.',
              fix: 'pnpm setup:macos-helper (then click "Allow" for Bluetooth access)',
            };
      case 'linux':
        return h.has('bluetoothctl')
          ? OK
          : {
              status: 'unavailable',
              reason:
                '"bluetoothctl" (BlueZ) is not installed.' + containerHint(h),
              fix: 'Install BlueZ, e.g. "sudo apt install bluez", and start bluetoothd.',
            };
      case 'win32':
        return {
          status: 'unavailable',
          reason: 'Bluetooth scanning is not implemented on Windows yet.',
          fix: 'Run the API on macOS or Linux.',
        };
      default:
        return unsupportedPlatform(h, 'Bluetooth scanning');
    }
  },
};

export function diagnosePlatform(h: HostFacts): ToolSupport[] {
  return (Object.keys(CHECKS) as ToolId[]).map((id) => ({
    id,
    ...CHECKS[id](h),
  }));
}

const ICONS: Record<SupportStatus, string> = {
  ok: '[ OK ]',
  limited: '[WARN]',
  unavailable: '[FAIL]',
  disabled: '[OFF ]',
};

/** Human-readable report, one block per tool. */
export function formatDiagnosis(results: ToolSupport[]): string[] {
  const width = Math.max(...results.map((r) => TOOL_CATALOG[r.id].name.length));
  const lines: string[] = [];
  for (const r of results) {
    const meta = TOOL_CATALOG[r.id];
    lines.push(
      `${ICONS[r.status]} ${meta.code} ${meta.name.padEnd(width)}  ${r.status}`,
    );
    if (r.reason) lines.push(`         why: ${r.reason}`);
    if (r.fix) lines.push(`         fix: ${r.fix}`);
  }
  return lines;
}

function containerHint(h: HostFacts): string {
  return h.inContainer ? CONTAINER_HINT : '';
}

function unsupportedPlatform(
  h: HostFacts,
  what: string,
): Omit<ToolSupport, 'id'> {
  return {
    status: 'unavailable',
    reason: `${what} is not supported on ${h.platform}.`,
    fix: 'Run the API on macOS or Linux.',
  };
}
