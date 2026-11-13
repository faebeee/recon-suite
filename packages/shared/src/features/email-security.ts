import { z } from 'zod';
import { domainSchema } from '../common/target.js';
import type { GradedReport } from '../common/finding.js';

/** Selectors probed when the user does not know the domain's DKIM selector. */
export const COMMON_DKIM_SELECTORS = [
  'default',
  'dkim',
  'mail',
  'google',
  'selector1',
  'selector2',
  'k1',
  'k2',
  's1',
  's2',
  'sig1',
  'smtp',
  'mandrill',
  'zoho',
  'protonmail',
  'fm1',
] as const;

export const MAX_EXTRA_DKIM_SELECTORS = 10;

const selectorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_-]{1,63}(\.[a-z0-9_-]{1,63}){0,3}$/,
    'DKIM selectors contain letters, digits, "-", "_" and dots only',
  );

export const emailSecurityInputSchema = z.object({
  target: domainSchema,
  /** Extra DKIM selectors to probe in addition to the common ones. */
  dkimSelectors: z
    .array(selectorSchema)
    .max(
      MAX_EXTRA_DKIM_SELECTORS,
      `At most ${MAX_EXTRA_DKIM_SELECTORS} extra selectors`,
    )
    .default([]),
});
export type EmailSecurityInput = z.input<typeof emailSecurityInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type EmailSecurityParams = z.output<typeof emailSecurityInputSchema>;

export interface SpfReport {
  record?: string;
  /** Number of `v=spf1` TXT records (more than one is invalid). */
  recordCount: number;
  /** Final `all` mechanism with qualifier, e.g. "-all". */
  all?: string;
  /** DNS-querying mechanisms counted against the RFC 7208 limit of 10. */
  lookups: number;
  /** Domains pulled in through include: and redirect=, in resolution order. */
  includes: string[];
  /** Problems found while walking includes (missing, loops, too deep). */
  errors: string[];
}

export interface DmarcReport {
  /** DNS name the record was found at (a parent domain when inherited). */
  name?: string;
  record?: string;
  policy?: string;
  subdomainPolicy?: string;
  pct?: number;
  rua: string[];
  ruf: string[];
}

export interface DkimSelectorResult {
  selector: string;
  found: boolean;
  keyType?: string;
  keyBits?: number;
  /** p= is empty: the key was revoked. */
  revoked?: boolean;
}

export interface EmailSecurityOutput {
  domain: string;
  /** "priority host" */
  mx: string[];
  spf: SpfReport;
  dmarc: DmarcReport;
  dkim: {
    checked: number;
    /** Only selectors that have a record. */
    found: DkimSelectorResult[];
  };
  mtaSts?: { record: string; id?: string };
  tlsRpt?: { record: string; rua: string[] };
  bimi?: { record: string; logo?: string };
  report: GradedReport;
}
