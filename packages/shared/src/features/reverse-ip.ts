import { z } from 'zod';
import { hostSchema } from '../common/target.js';

export const MAX_REVERSE_IP_DOMAINS = 500;

export const reverseIpInputSchema = z.object({
  /** IPv4 address, or a domain whose first A record is used. */
  target: hostSchema,
});
export type ReverseIpInput = z.input<typeof reverseIpInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type ReverseIpParams = z.output<typeof reverseIpInputSchema>;

export interface ReverseIpOutput {
  ip: string;
  /** Set when the target was a domain. */
  resolvedFrom?: string;
  source: 'securitytrails';
  /** Total hostnames the provider knows on this IP. */
  total: number;
  domains: string[];
  truncated: boolean;
}
