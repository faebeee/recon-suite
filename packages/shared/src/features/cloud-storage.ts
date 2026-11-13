import { z } from 'zod';
import { domainSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

export const MAX_EXTRA_BUCKET_NAMES = 10;

/** Bucket/container naming rules shared by S3, GCS and Azure (lowest common denominator). */
export const bucketNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
    'Bucket names are 3-63 characters: letters, digits, dots and hyphens',
  );

export const cloudStorageInputSchema = z.object({
  /** Company domain; candidate names are derived from it (example.com -> example, example-backup, ...). */
  target: domainSchema,
  extraNames: z.array(bucketNameSchema).max(MAX_EXTRA_BUCKET_NAMES).default([]),
});
export type CloudStorageInput = z.input<typeof cloudStorageInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type CloudStorageParams = z.output<typeof cloudStorageInputSchema>;

export type CloudProvider = 's3' | 'gcs' | 'azure';

/**
 * public-list: anonymous listing works (finding). exists-private: the bucket exists but
 * denies listing. not-found: no such bucket/account.
 */
export type BucketState =
  'public-list' | 'exists-private' | 'not-found' | 'error';

export interface BucketResult {
  provider: CloudProvider;
  name: string;
  url: string;
  state: BucketState;
  status?: number;
  /** First object keys when listing is public (max 10). */
  sampleKeys?: string[];
  error?: string;
}

export interface CloudStorageOutput {
  /** Candidate names that were checked. */
  names: string[];
  /** Only buckets that exist or errored; not-found results are counted, not listed. */
  results: BucketResult[];
  checked: number;
  findings: Finding[];
}
