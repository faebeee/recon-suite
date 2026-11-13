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
  'server' | 'security' | 'auth' | 'storage' | 'tooling' | 'integrations';

export const SETTING_GROUP_LABELS: Record<SettingGroup, string> = {
  server: 'Server',
  security: 'Security',
  auth: 'Authentication',
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
    activeSessions: number;
  };
  /** How many tools work fully / limited / not at all on this setup. */
  tools: Record<SupportStatus, number> & { total: number };
}

export const SYSTEM_OVERVIEW_ENDPOINT = '/system/overview';
