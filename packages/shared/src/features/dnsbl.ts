import { z } from 'zod';
import { hostSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

/** Max addresses checked when a domain resolves to many IPs. */
export const MAX_DNSBL_ADDRESSES = 4;

export const dnsblInputSchema = z.object({
  /** IPv4 address, or a domain (checked on domain lists, plus its IPv4 addresses on IP lists). */
  target: hostSchema,
});
export type DnsblInput = z.input<typeof dnsblInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type DnsblParams = z.output<typeof dnsblInputSchema>;

/**
 * listed: on the list. clean: not listed. refused: the list operator refused the query
 * (e.g. Spamhaus answers queries from public resolvers with an error code). error: lookup failed.
 */
export type DnsblStatus = 'listed' | 'clean' | 'refused' | 'error';

export interface DnsblCheck {
  list: string;
  zone: string;
  /** What was looked up: an IP or the domain. */
  subject: string;
  status: DnsblStatus;
  /** Return codes (127.0.0.x) of a listing. */
  codes: string[];
  /** Meaning of the return codes, e.g. "Exploits Block List (XBL)". */
  reasons: string[];
  /** The listing is informational (e.g. Spamhaus PBL: dynamic or end-user range). */
  policyOnly?: boolean;
  error?: string;
}

export interface DnsblOutput {
  query: string;
  kind: 'ip' | 'domain';
  /** IPv4 addresses checked on the IP lists. */
  addresses: string[];
  /** IPv6 addresses found but not checked (the lists here are IPv4-only). */
  skippedIpv6: string[];
  /** DNS servers that made the queries (some lists refuse public resolvers). */
  resolvers: string[];
  checks: DnsblCheck[];
  findings: Finding[];
}
