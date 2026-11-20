import type {
  SystemCheckStatus,
  SettingGroup,
  SupportStatus,
  SystemCheck,
  SystemOverview,
  SystemSetting,
} from '@recon/shared';
import type { Env } from '../../config/env.js';
import type { KaliState } from '../../core/process/tool-exec.js';

interface SettingMeta {
  group: SettingGroup;
  description: string;
  /** Never expose the value, only whether it is set. */
  secret?: boolean;
}

/** Every env variable needs an entry (the Record type enforces it), in display order. */
export const SETTING_META: Record<keyof Env, SettingMeta> = {
  PORT: { group: 'server', description: 'HTTP port of the API.' },
  CORS_ORIGIN: {
    group: 'server',
    description: 'Browser origins allowed to call the API.',
  },
  DATABASE_PATH: {
    group: 'storage',
    description: 'SQLite file for engagements, runs and notes.',
  },
  KALI_CONTAINER: {
    group: 'tooling',
    description: 'Container that runs nmap/ip instead of the API host.',
  },
  KALI_IMAGE: {
    group: 'tooling',
    description: 'Image to create KALI_CONTAINER from when it is missing.',
  },
  CONTAINER_CLI: {
    group: 'tooling',
    description: 'CLI used to reach the Kali container.',
  },
  NVD_API_KEY: {
    group: 'integrations',
    description: 'NVD API key, enables CVE Lookup.',
    secret: true,
  },
  SECURITYTRAILS_API_KEY: {
    group: 'integrations',
    description: 'SecurityTrails API key, enables Reverse IP.',
    secret: true,
  },
};

/** Effective settings. Secret values never leave this function, only whether they are set. */
export function describeSettings(env: Env, defaults: Env): SystemSetting[] {
  return (Object.keys(SETTING_META) as (keyof Env)[]).map((key) => {
    const meta = SETTING_META[key];
    const raw = env[key];
    const isSet = raw !== undefined && raw !== '';
    const secret = !!meta.secret;
    return {
      key,
      group: meta.group,
      description: meta.description,
      secret,
      isSet,
      value: secret || !isSet ? undefined : String(raw),
      isDefault: raw === defaults[key],
    };
  });
}

export interface CheckFacts {
  env: Env;
  /** undefined when KALI_CONTAINER is not set. */
  kali?: KaliState;
  database: { ok: true } | { ok: false; error: string };
  tools: SystemOverview['tools'];
}

/** Status checks shown on the system page, most important first. */
export function buildChecks(f: CheckFacts): SystemCheck[] {
  const { env } = f;
  const checks: SystemCheck[] = [
    { id: 'api', label: 'API', status: 'ok', detail: 'Running.' },
    f.database.ok
      ? {
          id: 'database',
          label: 'Database',
          status: 'ok',
          detail: 'Reachable.',
        }
      : {
          id: 'database',
          label: 'Database',
          status: 'error',
          detail: `Query failed: ${f.database.error}`,
          fix: 'Check DATABASE_PATH and the file permissions, then restart the API.',
        },
    kaliCheck(env, f.kali),
    toolsCheck(f.tools),
  ];

  checks.push(
    apiKeyCheck('nvd', 'NVD API', env.NVD_API_KEY, 'CVE Lookup', 'NVD_API_KEY'),
    apiKeyCheck(
      'securitytrails',
      'SecurityTrails API',
      env.SECURITYTRAILS_API_KEY,
      'Reverse IP',
      'SECURITYTRAILS_API_KEY',
    ),
  );
  return checks;
}

const SEVERITY: Record<SystemCheckStatus, number> = {
  off: 0,
  ok: 0,
  warn: 1,
  error: 2,
};

/** Worst status across all checks; `off` counts as ok. */
export function overallStatus(
  checks: SystemCheck[],
): Exclude<SystemCheckStatus, 'off'> {
  const worst = Math.max(0, ...checks.map((c) => SEVERITY[c.status]));
  return worst === 2 ? 'error' : worst === 1 ? 'warn' : 'ok';
}

export function countTools(statuses: SupportStatus[]): SystemOverview['tools'] {
  const counts = { ok: 0, limited: 0, unavailable: 0, disabled: 0 };
  for (const s of statuses) counts[s]++;
  return { ...counts, total: statuses.length };
}

function kaliCheck(env: Env, kali?: KaliState): SystemCheck {
  const base = { id: 'kali', label: 'Kali container' };
  if (!env.KALI_CONTAINER || !kali) {
    return {
      ...base,
      status: 'off',
      detail: 'Not configured: nmap and ip run on the API host.',
    };
  }
  const name = env.KALI_CONTAINER;
  switch (kali.state) {
    case 'running':
      return { ...base, status: 'ok', detail: `"${name}" is running.` };
    case 'stopped':
      return {
        ...base,
        status: 'warn',
        detail: `"${name}" is ${kali.detail}; it is started on the next scan.`,
      };
    case 'missing':
      return env.KALI_IMAGE
        ? {
            ...base,
            status: 'warn',
            detail: `"${name}" does not exist; it is created from ${env.KALI_IMAGE} on the next scan.`,
          }
        : {
            ...base,
            status: 'error',
            detail: `"${name}" does not exist.`,
            fix: 'Run "pnpm compose:up", or set KALI_IMAGE so the API can create it.',
          };
    case 'unreachable':
      return {
        ...base,
        status: 'error',
        detail: `Container engine not reachable: ${kali.detail}.`,
        fix: `Start ${env.CONTAINER_CLI} and make sure the API can use its socket.`,
      };
  }
}

function toolsCheck(tools: SystemOverview['tools']): SystemCheck {
  const base = { id: 'tools', label: 'Tools' };
  const detail =
    `${tools.ok}/${tools.total} fully supported` +
    (tools.limited ? `, ${tools.limited} limited` : '') +
    (tools.unavailable ? `, ${tools.unavailable} unavailable` : '') +
    (tools.disabled ? `, ${tools.disabled} disabled` : '') +
    '.';
  return tools.unavailable
    ? {
        ...base,
        status: 'warn',
        detail,
        fix: 'See the tool list below for what to install or change.',
      }
    : { ...base, status: 'ok', detail };
}

function apiKeyCheck(
  id: string,
  label: string,
  key: string | undefined,
  tool: string,
  envName: string,
): SystemCheck {
  return key
    ? { id, label, status: 'ok', detail: `Key set; ${tool} is enabled.` }
    : {
        id,
        label,
        status: 'off',
        detail: `No key; ${tool} is unavailable.`,
        fix: `Set ${envName} to enable ${tool}.`,
      };
}
