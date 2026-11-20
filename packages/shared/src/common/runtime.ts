import type { ToolId } from './tool.js';

/**
 * Where a tool's work actually executes:
 * host:      natively on the machine running the API (`pnpm dev`)
 * container: inside the API container (compose; the image is built on Kali)
 */
export type RuntimeLocation = 'host' | 'container';

/**
 * ok:          works fully on this setup.
 * limited:     works, but with reduced data or only under extra conditions.
 * unavailable: cannot work until something is installed/changed.
 * disabled:    switched off by configuration.
 */
export type SupportStatus = 'ok' | 'limited' | 'unavailable' | 'disabled';

export interface ToolRuntime {
  id: ToolId;
  location: RuntimeLocation;
  /** What does the work under the hood, e.g. "nmap -sn", "Node.js net/tls", "nmcli". */
  engine: string;
  /** Third-party services the tool queries (never the target itself), e.g. "crt.sh". */
  services: string[];
  status: SupportStatus;
  /** Why the tool is limited/unavailable (human readable). */
  reason?: string;
  /** What to install or change to fix it. */
  fix?: string;
}

/** Response of GET /api/system/runtime (authenticated: it describes the server). */
export interface RuntimeInfo {
  api: {
    location: RuntimeLocation;
    platform: string;
  };
  tools: ToolRuntime[];
}

export const SYSTEM_RUNTIME_ENDPOINT = '/system/runtime';
