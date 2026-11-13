import { z } from 'zod';

export const organisationSchema = z
  .string()
  .trim()
  .min(2, 'Enter an organisation name, e.g. Example Inc')
  .max(100);

export const certSearchInputSchema = z.object({
  /** Organisation name as it appears in certificate subjects (O=). */
  target: organisationSchema,
  includeExpired: z.boolean().default(false),
});
export type CertSearchInput = z.input<typeof certSearchInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type CertSearchParams = z.output<typeof certSearchInputSchema>;

export interface OrgDomain {
  name: string;
  wildcard: boolean;
  certificates: number;
  firstSeen: string;
  lastSeen: string;
}

export interface CertSearchOutput {
  organisation: string;
  source: 'crt.sh';
  /** Certificates matched. */
  certificates: number;
  /** Distinct names from those certificates (capped at 2000). */
  domains: OrgDomain[];
  /** Distinct registrable-looking apex domains (last two labels), for pivots. */
  apexDomains: string[];
}
