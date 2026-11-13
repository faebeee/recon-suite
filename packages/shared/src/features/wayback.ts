import { z } from 'zod';
import { domainSchema } from '../common/target.js';

export const waybackInputSchema = z.object({
  target: domainSchema,
  includeSubdomains: z.boolean().default(false),
  /** Max distinct URLs requested from the archive. */
  limit: z.number().int().min(10).max(5000).default(1000),
});
export type WaybackInput = z.input<typeof waybackInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type WaybackParams = z.output<typeof waybackInputSchema>;

export interface ArchivedUrl {
  url: string;
  /** ISO date of the capture (the archive returns one capture per distinct URL). */
  lastSeen: string;
  status?: number;
  mimeType?: string;
}

export interface InterestingUrl {
  url: string;
  /** e.g. "backup file", "config file", "token in query", "admin path". */
  reason: string;
}

export interface WaybackOutput {
  domain: string;
  source: 'web.archive.org';
  total: number;
  /** Hit the limit: more URLs exist in the archive. */
  truncated: boolean;
  urls: ArchivedUrl[];
  interesting: InterestingUrl[];
  /** Distinct query parameter names seen, most frequent first (max 100). */
  parameters: { name: string; count: number }[];
  /** Distinct file extensions seen with counts. */
  extensions: { ext: string; count: number }[];
}
