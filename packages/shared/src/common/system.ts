import type { RuntimeLocation, SupportStatus } from './runtime.js';

/**
 * ok:    healthy / configured as recommended.
 * warn:  works, but needs attention (weakened security, degraded component).
 * error: broken; something does not work until it is fixed.
 * off:   optional and not configured or switched off.
 */
export type SystemCheckStatus = 'ok' | 'warn' | 'error' | 'off';

export interface SystemCheck {
  id: string;
  label: string;
  status: SystemCheckStatus;
  /** Current state in one sentence (human readable). */
  detail: string;
  /** What to change to reach `ok` (only when not ok). */
  fix?: string;
}

export type SettingGroup =
  'server' | 'security' | 'storage' | 'tooling' | 'integrations';

export const SETTING_GROUP_LABELS: Record<SettingGroup, string> = {
  server: 'Server',
  security: 'Security',
  storage: 'Storage',
  tooling: 'Tool execution',
  integrations: 'Integrations',
};

/** One environment variable of the API. Secrets never carry a value, only `isSet`. */
export interface SystemSetting {
  key: string;
  group: SettingGroup;
  description: string;
  secret: boolean;
  /** Whether a value is in effect (set explicitly or by a non-empty default). */
  isSet: boolean;
  /** Effective value; omitted for secrets and unset optional settings. */
  value?: string;
  /** Effective value equals the built-in default. */
  isDefault: boolean;
}

export interface SystemOverview {
  generatedAt: string;
  api: {
    version: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    location: Exclude<RuntimeLocation, 'kali'>;
    startedAt: string;
    uptimeSeconds: number;
    memoryRssBytes: number;
  };
  /** Worst status across `checks` (`off` counts as ok). */
  status: Exclude<SystemCheckStatus, 'off'>;
  checks: SystemCheck[];
  settings: SystemSetting[];
  database: {
    /** Resolved file path, or ":memory:". */
    path: string;
    /** File size incl. the WAL file; omitted for in-memory databases. */
    sizeBytes?: number;
    engagements: number;
    runs: number;
    notes: number;
  };
  /** How many tools work fully / limited / not at all on this setup. */
  tools: Record<SupportStatus, number> & { total: number };
}

export const SYSTEM_OVERVIEW_ENDPOINT = '/system/overview';

export interface HostAddress {
  address: string;
  family: 4 | 6;
  /** CIDR notation, e.g. "192.168.1.20/24". */
  cidr: string;
}

export interface HostInterface {
  name: string;
  /** Hardware address; omitted for virtual interfaces without one. */
  mac?: string;
  addresses: HostAddress[];
  /** Carries the default route. */
  isDefault: boolean;
}

export interface ConnectivityCheck {
  ok: boolean;
  /** Round-trip time of the check. */
  ms?: number;
  /** Why it failed (human readable). */
  error?: string;
}

/**
 * online:   DNS and HTTPS work.
 * degraded: one of them works (e.g. DNS broken but direct IP reachable).
 * offline:  neither works.
 */
export type InternetStatus = 'online' | 'degraded' | 'offline';

/** Response of GET /api/system/host: the machine (or container) the API runs on. */
export interface HostStats {
  generatedAt: string;
  hostname: string;
  /** Where the API runs; in a container, network data is the container's. */
  location: 'host' | 'container';
  os: { platform: string; release: string; arch: string };
  uptimeSeconds: number;
  /** 1, 5 and 15 minute load averages (zeros on Windows). */
  loadAverage: [number, number, number];
  cpu: { model: string; cores: number };
  /** freeBytes: memory available right away (incl. reclaimable cache where the OS reports it). */
  memory: { totalBytes: number; freeBytes: number };
  network: {
    interfaces: HostInterface[];
    defaultGateway?: { address: string; interface?: string };
    dnsServers: string[];
  };
  internet: {
    status: InternetStatus;
    /** Resolving a well-known name with the system resolver. */
    dns: ConnectivityCheck;
    /** HTTPS request to a fixed endpoint (Cloudflare 1.1.1.1). */
    https: ConnectivityCheck;
    /** Public IP as seen by Cloudflare. */
    publicIp?: string;
    /** Country code and Cloudflare data center, e.g. "CH" / "ZRH". */
    country?: string;
    colo?: string;
    checkedAt: string;
  };
}

export const SYSTEM_HOST_ENDPOINT = '/system/host';
