import { z } from 'zod';
import type { Finding } from '../common/finding.js';
import { hostSchema, portSchema } from '../common/target.js';

/** nmap's own "most common ports" lists. */
export const NMAP_TOP_PORTS = [100, 1000] as const;
export type NmapTopPorts = (typeof NMAP_TOP_PORTS)[number];

/** Upper bound for an explicit port list (keeps scan time and output bounded). */
export const MAX_NMAP_PORTS = 1000;

export const nmapInputSchema = z.object({
  target: hostSchema,
  /** Scan nmap's N most common TCP ports. Ignored when `ports` is given. */
  topPorts: z
    .union([z.literal(NMAP_TOP_PORTS[0]), z.literal(NMAP_TOP_PORTS[1])])
    .default(100),
  /** Explicit TCP ports instead of the top-ports list. */
  ports: z.array(portSchema).min(1).max(MAX_NMAP_PORTS).optional(),
  /** Probe open ports to identify service, product and version (`-sV`). */
  serviceDetection: z.boolean().default(true),
});
export type NmapInput = z.input<typeof nmapInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type NmapParams = z.output<typeof nmapInputSchema>;

export interface NmapPort {
  port: number;
  protocol: string;
  /** nmap state, e.g. "open" (only open ports are reported, see `--open`). */
  state: string;
  /** Why nmap decided on the state, e.g. "syn-ack". */
  reason?: string;
  service?: string;
  product?: string;
  version?: string;
  extraInfo?: string;
  /** "probed" with -sV, "table" when only guessed from the port number. */
  method?: string;
  cpe: string[];
}

export interface NmapOutput {
  /** The resolved IP that nmap scanned (never the raw hostname). */
  address: string;
  hostState: 'up' | 'down' | 'unknown';
  ports: NmapPort[];
  /** Ports nmap scanned in total (open + the ones it summarised). */
  scannedPorts: number;
  nmapVersion?: string;
  elapsedSeconds?: number;
  /** The command that ran, including where (Kali container or API host). */
  method: string;
  runner: 'kali' | 'local';
  findings: Finding[];
}
