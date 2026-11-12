import { z } from 'zod';
import { hostSchema, portSchema } from '../common/target.js';

export const WELL_KNOWN_PORTS: Record<number, string> = {
  21: 'ftp',
  22: 'ssh',
  23: 'telnet',
  25: 'smtp',
  53: 'dns',
  80: 'http',
  110: 'pop3',
  143: 'imap',
  443: 'https',
  445: 'smb',
  465: 'smtps',
  587: 'submission',
  993: 'imaps',
  995: 'pop3s',
  1433: 'mssql',
  3306: 'mysql',
  3389: 'rdp',
  5432: 'postgres',
  5900: 'vnc',
  6379: 'redis',
  8080: 'http-alt',
  8443: 'https-alt',
  9200: 'elasticsearch',
  27017: 'mongodb',
};

export const PORT_PRESETS = {
  common: Object.keys(WELL_KNOWN_PORTS).map(Number),
  web: [80, 443, 8000, 8080, 8443, 8888],
  mail: [25, 110, 143, 465, 587, 993, 995],
  database: [1433, 3306, 5432, 6379, 9200, 27017],
} as const satisfies Record<string, readonly number[]>;

export const MAX_PORTS_PER_SCAN = 64;

export const portsInputSchema = z.object({
  target: hostSchema,
  ports: z
    .array(portSchema)
    .min(1)
    .max(MAX_PORTS_PER_SCAN)
    .default([...PORT_PRESETS.common]),
  timeoutMs: z.number().int().min(250).max(5000).default(1500),
});
export type PortsInput = z.input<typeof portsInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type PortsParams = z.output<typeof portsInputSchema>;

export type PortState = 'open' | 'closed' | 'filtered';

export interface PortResult {
  port: number;
  service?: string;
  state: PortState;
  latencyMs?: number;
}

export interface PortsOutput {
  address: string;
  open: number;
  results: PortResult[];
}
