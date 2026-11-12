import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';

export const httpHeadersInputSchema = z.object({
  target: httpUrlSchema,
  method: z.enum(['GET', 'HEAD']).default('GET'),
  followRedirects: z.boolean().default(true),
});
export type HttpHeadersInput = z.input<typeof httpHeadersInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type HttpHeadersParams = z.output<typeof httpHeadersInputSchema>;

export interface HttpHop {
  url: string;
  status: number;
  statusText: string;
  location?: string;
  durationMs: number;
}

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface SecurityCheck {
  header: string;
  status: CheckStatus;
  message: string;
  value?: string;
}

export interface SecurityReport {
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  checks: SecurityCheck[];
  /** Headers that leak implementation details. */
  disclosures: { header: string; value: string }[];
}

export interface HttpHeadersOutput {
  finalUrl: string;
  status: number;
  hops: HttpHop[];
  headers: Record<string, string>;
  security: SecurityReport;
}
