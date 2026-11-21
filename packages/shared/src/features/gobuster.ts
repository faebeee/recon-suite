import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';
import { DIR_BUSTER_EXTENSIONS } from './dir-buster.js';

/**
 * Runs `gobuster dir` on the API host against the guard-resolved IP of the target (Host header
 * set to the hostname). Wordlists come from a server-side allowlist of installed lists
 * (GOBUSTER_WORDLISTS_ENDPOINT), never from a client-supplied path. Bounded by a hard time
 * limit and a thread cap (AGENTS.md rules 3 and 4).
 */
export const GOBUSTER_WORDLISTS_ENDPOINT = '/tools/gobuster/wordlists';

export const GOBUSTER_EXTENSIONS = DIR_BUSTER_EXTENSIONS;
export type GobusterExtension = (typeof GOBUSTER_EXTENSIONS)[number];
export const MAX_GOBUSTER_EXTENSIONS = 5;
export const MAX_GOBUSTER_THREADS = 50;
export const MAX_GOBUSTER_MINUTES = 30;

export const gobusterInputSchema = z.object({
  /** Base URL; gobuster requests <base>/<word>. */
  target: httpUrlSchema,
  /** Id from GET GOBUSTER_WORDLISTS_ENDPOINT; checked against the installed lists. */
  wordlist: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/, 'Unknown wordlist')
    .default('builtin-common'),
  extensions: z
    .array(z.enum(GOBUSTER_EXTENSIONS))
    .max(MAX_GOBUSTER_EXTENSIONS)
    .default([]),
  threads: z.number().int().min(1).max(MAX_GOBUSTER_THREADS).default(10),
  /** The scan is stopped after this long; what it found until then is returned. */
  timeLimitMinutes: z
    .number()
    .int()
    .min(1)
    .max(MAX_GOBUSTER_MINUTES)
    .default(10),
  /**
   * Response sizes to ignore (gobuster --exclude-length), for servers that answer unknown
   * paths with a fixed page instead of 404.
   */
  excludeLengths: z
    .array(z.number().int().min(0).max(100_000_000))
    .max(10)
    .default([]),
});
export type GobusterInput = z.input<typeof gobusterInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type GobusterParams = z.output<typeof gobusterInputSchema>;

export interface GobusterWordlist {
  id: string;
  label: string;
  /** Where it was found on the API host; built-in lists have none. */
  path?: string;
  lines: number;
  builtIn: boolean;
}

/** Response of GET GOBUSTER_WORDLISTS_ENDPOINT. */
export interface GobusterWordlistsOutput {
  /** gobuster is on the API host's PATH. */
  installed: boolean;
  wordlists: GobusterWordlist[];
}

export interface GobusterHit {
  /** Path below the origin, e.g. /admin. */
  path: string;
  url: string;
  status: number;
  length?: number;
  /** Redirect target, with the scanned IP shown as the original host again. */
  redirect?: string;
}

export interface GobusterOutput {
  base: string;
  /** IP gobuster connected to (the guard-resolved address of the target). */
  address: string;
  wordlist: Pick<GobusterWordlist, 'id' | 'label' | 'lines'>;
  extensions: GobusterExtension[];
  threads: number;
  timeLimitMinutes: number;
  /** Set when the time limit ended the scan; hits found until then are kept. */
  stopped?: 'time-limit';
  /** The command that ran (wordlist path and arguments). */
  command: string;
  hits: GobusterHit[];
  findings: Finding[];
}
