export const TOOL_IDS = [
  'dns',
  'whois',
  'subdomains',
  'http-headers',
  'tls',
  'ports',
  'host-scan',
  'wifi',
  'bluetooth',
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export type ToolCategory = 'dns' | 'intel' | 'web' | 'network' | 'wireless';

/**
 * passive: only talks to third parties (resolvers, registries, CT logs).
 * active:  connects to the target itself.
 */
export type ToolMode = 'passive' | 'active';

/**
 * remote: runs against a user-supplied `target`.
 * local:  inspects the environment of the machine running the API (no target).
 */
export type ToolScope = 'remote' | 'local';

export interface ToolMeta {
  id: ToolId;
  /** Short display code, e.g. "D-01". */
  code: string;
  name: string;
  tagline: string;
  description: string;
  category: ToolCategory;
  mode: ToolMode;
  scope: ToolScope;
  /** Placeholder shown in the target input (empty for local tools). */
  targetHint: string;
}

/** Envelope every tool endpoint returns. */
export interface ToolResult<T> {
  tool: ToolId;
  /** The scanned target; for local tools the API host name. */
  target: string;
  startedAt: string;
  durationMs: number;
  data: T;
}

/**
 * Explains why a local tool returned degraded data (e.g. missing OS permission) and how to fix it.
 * The web UI renders it as a notice panel with a copyable command.
 */
export interface HostNotice {
  reason: string;
  fix: string;
  command?: string;
}

/** Every tool is served at POST /api/tools/:id */
export function toolEndpoint(id: ToolId): string {
  return `/tools/${id}`;
}
