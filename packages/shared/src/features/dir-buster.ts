import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

/**
 * Directory and file discovery (DirBuster / gobuster style): requests wordlist paths below a
 * base URL and reports what exists. Bounded on every axis (AGENTS.md rule 3): built-in
 * wordlists, a capped list of extra words, MAX_DIR_BUSTER_REQUESTS requests and a time budget
 * per scan, few parallel requests. Requests are plain GETs; nothing is submitted or exploited.
 */
export const DIR_BUSTER_WORDLISTS = ['quick', 'common'] as const;
export type DirBusterWordlist = (typeof DIR_BUSTER_WORDLISTS)[number];

/** File extensions tried for every word, in addition to the bare word. */
export const DIR_BUSTER_EXTENSIONS = [
  'php',
  'html',
  'txt',
  'json',
  'xml',
  'js',
  'asp',
  'aspx',
  'jsp',
  'bak',
  'old',
  'zip',
  'sql',
] as const;
export type DirBusterExtension = (typeof DIR_BUSTER_EXTENSIONS)[number];

export const MAX_DIR_BUSTER_EXTENSIONS = 5;
export const MAX_DIR_BUSTER_EXTRA_WORDS = 200;
/** Hard cap on HTTP requests per scan (calibration included). */
export const MAX_DIR_BUSTER_REQUESTS = 3000;
/** Scans stop after this long and return what they found. */
export const DIR_BUSTER_TIME_BUDGET_MS = 180_000;

/** One path segment: no slashes, no query, no traversal. */
const wordSchema = z
  .string()
  .trim()
  .regex(
    /^(?!\.{1,2}$)[A-Za-z0-9._~-]{1,64}$/,
    'Words may contain letters, digits and . _ ~ - (one path segment, max 64 characters)',
  );

export const dirBusterInputSchema = z.object({
  /** Base URL; words are requested below its path (https://example.com/app/ -> /app/<word>). */
  target: httpUrlSchema,
  wordlist: z.enum(DIR_BUSTER_WORDLISTS).default('quick'),
  /** Extra words tried in addition to the built-in list (deduplicated). */
  extraWords: z.array(wordSchema).max(MAX_DIR_BUSTER_EXTRA_WORDS).default([]),
  extensions: z
    .array(z.enum(DIR_BUSTER_EXTENSIONS))
    .max(MAX_DIR_BUSTER_EXTENSIONS)
    .default([]),
  /** 1 = only the base path; 2-3 also scan inside directories that were found. */
  depth: z.number().int().min(1).max(3).default(1),
  /** Parallel requests. */
  threads: z.number().int().min(1).max(10).default(5),
});
export type DirBusterInput = z.input<typeof dirBusterInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type DirBusterParams = z.output<typeof dirBusterInputSchema>;

export type DirBusterKind = 'directory' | 'file';

export interface DirBusterHit {
  /** Path below the origin, e.g. /admin/ or /backup.zip. */
  path: string;
  url: string;
  status: number;
  kind: DirBusterKind;
  /** Body size in bytes (Content-Length, or what was read; capped). */
  length?: number;
  contentType?: string;
  /** Location header of a redirect. */
  redirect?: string;
  /** <title> of an HTML page. */
  title?: string;
  /** The response is a server-generated directory index ("Index of /..."). */
  listing?: boolean;
  /** 1 = found directly below the base URL. */
  depth: number;
}

export type DirBusterStop = 'request-limit' | 'time-limit' | 'rate-limited';

export interface DirBusterOutput {
  base: string;
  wordlist: DirBusterWordlist;
  words: number;
  extensions: DirBusterExtension[];
  requests: number;
  /** Requests that failed (timeouts, resets). */
  errors: number;
  /** Set when the scan ended early; the hits found so far are still returned. */
  stopped?: DirBusterStop;
  /**
   * Directories where unknown paths do not answer 404 (catch-all routes, soft 404s); hits
   * there are only kept when they differ from that response.
   */
  wildcardDirs: string[];
  hits: DirBusterHit[];
  findings: Finding[];
}
