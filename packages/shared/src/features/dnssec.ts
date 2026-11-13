import { z } from 'zod';
import { domainSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

export const dnssecInputSchema = z.object({
  target: domainSchema,
});
export type DnssecInput = z.input<typeof dnssecInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type DnssecParams = z.output<typeof dnssecInputSchema>;

/**
 * secure: chain validates (AD flag). insecure: no DS at the parent (unsigned delegation).
 * bogus: signed but validation fails. indeterminate: could not tell.
 */
export type DnssecStatus = 'secure' | 'insecure' | 'bogus' | 'indeterminate';

export interface DsRecord {
  keyTag: number;
  algorithm: number;
  algorithmName: string;
  digestType: number;
  digest: string;
}

export interface DnskeyRecord {
  flags: number;
  /** 257 = KSK (SEP bit), 256 = ZSK. */
  role: 'KSK' | 'ZSK' | 'other';
  algorithm: number;
  algorithmName: string;
  /** Key size in bits where derivable (RSA), else undefined. */
  keyBits?: number;
}

export interface RrsigRecord {
  typeCovered: string;
  algorithm: number;
  signer: string;
  inception: string;
  expiration: string;
  /** Days until expiration (negative when expired). */
  daysRemaining: number;
}

export interface DnssecOutput {
  domain: string;
  /** DNS-over-HTTPS resolver used for validation. */
  resolver: string;
  status: DnssecStatus;
  ds: DsRecord[];
  dnskeys: DnskeyRecord[];
  signatures: RrsigRecord[];
  /** Authenticated denial of existence in use, if observed. */
  denial?: 'NSEC' | 'NSEC3';
  findings: Finding[];
}
