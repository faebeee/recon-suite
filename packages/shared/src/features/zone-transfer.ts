import { z } from 'zod';
import { domainSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

/** Records kept per nameserver when a transfer succeeds (the count is always complete). */
export const MAX_ZONE_RECORDS = 500;

export const zoneTransferInputSchema = z.object({
  target: domainSchema,
});
export type ZoneTransferInput = z.input<typeof zoneTransferInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type ZoneTransferParams = z.output<typeof zoneTransferInputSchema>;

export interface ZoneRecord {
  name: string;
  type: string;
  ttl: number;
  value: string;
}

export interface ZoneTransferAttempt {
  nameserver: string;
  /** Address the AXFR was sent to (one per nameserver, first allowed address). */
  address?: string;
  /** allowed: the server sent the zone. refused: REFUSED/NOTAUTH/closed. */
  status: 'allowed' | 'refused' | 'timeout' | 'error';
  error?: string;
  /** Total records received (allowed only). */
  recordCount?: number;
  /** First MAX_ZONE_RECORDS records. */
  records?: ZoneRecord[];
  truncated?: boolean;
}

export interface ZoneTransferOutput {
  domain: string;
  attempts: ZoneTransferAttempt[];
  findings: Finding[];
}
