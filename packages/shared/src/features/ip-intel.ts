import { z } from 'zod';
import { hostSchema } from '../common/target.js';

/** Max addresses analysed when a domain resolves to many IPs. */
export const MAX_IP_INTEL_ADDRESSES = 8;

export const ipIntelInputSchema = z.object({
  /** IP address, or a domain whose A/AAAA records are analysed. */
  target: hostSchema,
});
export type IpIntelInput = z.input<typeof ipIntelInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type IpIntelParams = z.output<typeof ipIntelInputSchema>;

export type ProviderKind = 'cdn' | 'cloud' | 'hosting';

export interface IpAsn {
  number: number;
  name?: string;
  prefix?: string;
  country?: string;
  registry?: string;
  allocated?: string;
}

export interface IpNetwork {
  name?: string;
  handle?: string;
  cidr: string[];
  country?: string;
  type?: string;
  organisation?: string;
}

export interface IpIntelAddress {
  ip: string;
  version: 4 | 6;
  /** Reverse DNS names. */
  ptr: string[];
  /** A PTR name resolves back to this IP (FCrDNS). null when there is no PTR. */
  forwardConfirmed: boolean | null;
  asn?: IpAsn;
  network?: IpNetwork;
  provider?: { name: string; kind: ProviderKind };
  /** Lookups that failed for this address (others still succeeded). */
  errors: string[];
}

export interface IpIntelOutput {
  query: string;
  kind: 'ip' | 'domain';
  /** Total addresses the domain resolved to (may exceed what was analysed). */
  resolvedCount: number;
  addresses: IpIntelAddress[];
}
