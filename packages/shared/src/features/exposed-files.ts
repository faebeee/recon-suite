import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

/**
 * Fixed list of well-known leaks. Deliberately short and not user-extensible: this is a
 * misconfiguration check, not a path brute-forcer (AGENTS.md security rule 4).
 */
export const EXPOSED_FILE_CHECKS = [
  { path: '/.git/HEAD', title: 'Git repository', severity: 'high' },
  { path: '/.git/config', title: 'Git config', severity: 'high' },
  { path: '/.svn/entries', title: 'Subversion metadata', severity: 'high' },
  { path: '/.hg/requires', title: 'Mercurial repository', severity: 'high' },
  { path: '/.env', title: 'Environment file', severity: 'high' },
  { path: '/.DS_Store', title: 'macOS folder metadata', severity: 'medium' },
  { path: '/server-status', title: 'Apache server-status', severity: 'medium' },
  { path: '/server-info', title: 'Apache server-info', severity: 'medium' },
  { path: '/phpinfo.php', title: 'phpinfo()', severity: 'medium' },
  {
    path: '/actuator',
    title: 'Spring Boot actuator index',
    severity: 'medium',
  },
  {
    path: '/actuator/env',
    title: 'Spring Boot actuator env',
    severity: 'high',
  },
  {
    path: '/.well-known/openid-configuration',
    title: 'OpenID configuration',
    severity: 'info',
  },
  { path: '/swagger.json', title: 'Swagger/OpenAPI spec', severity: 'low' },
  { path: '/openapi.json', title: 'OpenAPI spec', severity: 'low' },
  {
    path: '/crossdomain.xml',
    title: 'Flash cross-domain policy',
    severity: 'low',
  },
  { path: '/.htaccess', title: 'Apache .htaccess', severity: 'medium' },
  { path: '/web.config', title: 'IIS web.config', severity: 'high' },
  {
    path: '/wp-config.php.bak',
    title: 'WordPress config backup',
    severity: 'high',
  },
] as const satisfies readonly {
  path: string;
  title: string;
  severity: ExposureSeverity;
}[];

export type ExposureSeverity = 'high' | 'medium' | 'low' | 'info';

export const exposedFilesInputSchema = z.object({
  /** Any URL or bare domain; only its origin is used. */
  target: httpUrlSchema,
});
export type ExposedFilesInput = z.input<typeof exposedFilesInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type ExposedFilesParams = z.output<typeof exposedFilesInputSchema>;

export interface ExposedFileCheck {
  path: string;
  title: string;
  severity: ExposureSeverity;
  url: string;
  status?: number;
  /** Content matched the expected signature of the file (not just status 200). */
  exposed: boolean;
  /** 200 but the content is an HTML page or does not match the file's signature. */
  soft404?: boolean;
  /** Short, sanitised excerpt proving the exposure (max 200 chars, secrets masked). */
  evidence?: string;
  error?: string;
}

export interface ExposedFilesOutput {
  origin: string;
  checks: ExposedFileCheck[];
  findings: Finding[];
}
