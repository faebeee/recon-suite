import { z } from 'zod';
import { domainSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

export const MAX_TAKEOVER_HOSTS = 200;

export const takeoverInputSchema = z.object({
  target: domainSchema,
  /** ct: subdomains from certificate transparency (crt.sh). list: only `hosts`. */
  source: z.enum(['ct', 'list']).default('ct'),
  /** Extra hostnames to check (with source=list: the only ones). */
  hosts: z.array(domainSchema).max(MAX_TAKEOVER_HOSTS).default([]),
});
export type TakeoverInput = z.input<typeof takeoverInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type TakeoverParams = z.output<typeof takeoverInputSchema>;

/**
 * vulnerable: provider fingerprint matched (dangling resource can likely be claimed).
 * likely: CNAME to a takeover-prone provider whose target does not resolve.
 * safe: points to a known provider and the resource exists.
 */
export type TakeoverStatus = 'vulnerable' | 'likely' | 'safe' | 'unknown';

export interface TakeoverCandidate {
  host: string;
  /** CNAME chain, first hop first. */
  cname: string[];
  provider?: string;
  status: TakeoverStatus;
  /** CNAME target (or host) returns NXDOMAIN. */
  dangling: boolean;
  reason: string;
}

export interface TakeoverOutput {
  domain: string;
  source: 'ct' | 'list';
  /** Hostnames examined (capped at MAX_TAKEOVER_HOSTS). */
  checked: number;
  /** Hosts with a CNAME or provider match; others are omitted. */
  candidates: TakeoverCandidate[];
  findings: Finding[];
}
