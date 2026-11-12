import { TOOL_CATALOG, type ToolId } from '@recon/shared';

/**
 * ok:          works fully on this host.
 * limited:     works, but with reduced data or only under extra conditions.
 * unavailable: cannot work until something is installed/changed.
 * disabled:    switched off by configuration.
 */
export type SupportStatus = 'ok' | 'limited' | 'unavailable' | 'disabled';

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
  localToolsEnabled: boolean;
  /** Is a command available on PATH? */
  has: (command: string) => boolean;
  macosHelperInstalled: boolean;
  isRoot: boolean;
  inContainer: boolean;
  hasIpv4Interface: boolean;
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
  'http-headers': () => OK,
  tls: () => OK,
  ports: () => OK,

  'host-scan': (h) => {
    if (h.platform === 'win32') {
      return {
        status: 'unavailable',
        reason: 'arp-scan is not available on Windows.',
        fix: 'Run the API on Linux or macOS.',
      };
    }
    if (!h.has('arp-scan')) {
      return {
        status: 'unavailable',
        reason: '"arp-scan" is not installed.',
        fix:
          h.platform === 'darwin'
            ? 'brew install arp-scan'
            : 'Install it, e.g. "sudo apt install arp-scan" or "sudo dnf install arp-scan".',
      };
    }
    if (!h.hasIpv4Interface) {
      return {
        status: 'unavailable',
        reason: 'No non-loopback IPv4 network interface found.',
        fix: 'Connect the host to a network.',
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
    // The container image gives arp-scan the cap_net_raw file capability itself.
    if (!h.isRoot && !h.inContainer) {
      return {
        status: 'limited',
        reason:
          'arp-scan needs raw socket access and the API is not running as root.',
        fix:
          h.platform === 'linux'
            ? 'Grant the capability once: sudo setcap cap_net_raw+ep "$(which arp-scan)"'
            : 'Run the API with root privileges (macOS needs root to open /dev/bpf*).',
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
  return (Object.keys(CHECKS) as ToolId[]).map((id) => {
    if (TOOL_CATALOG[id].scope === 'local' && !h.localToolsEnabled) {
      return {
        id,
        status: 'disabled',
        reason: 'Local tools are disabled (LOCAL_TOOLS_ENABLED=false).',
        fix: 'Set LOCAL_TOOLS_ENABLED=true when the API runs on a trusted machine.',
      };
    }
    return { id, ...CHECKS[id](h) };
  });
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
