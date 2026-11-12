import { z } from 'zod';
import { domainSchema } from '../common/target.js';

export const subdomainsInputSchema = z.object({
  target: domainSchema,
  includeExpired: z.boolean().default(false),
});
export type SubdomainsInput = z.input<typeof subdomainsInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type SubdomainsParams = z.output<typeof subdomainsInputSchema>;

export interface Subdomain {
  name: string;
  /** Seen as a wildcard entry (*.name) in at least one certificate. */
  wildcard: boolean;
  firstSeen: string;
  lastSeen: string;
  certificates: number;
}

export interface SubdomainsOutput {
  source: 'crt.sh';
  total: number;
  subdomains: Subdomain[];
}
