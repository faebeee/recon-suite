import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding, FindingStatus } from '../common/finding.js';

export const corsInputSchema = z.object({
  target: httpUrlSchema,
});
export type CorsInput = z.input<typeof corsInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type CorsParams = z.output<typeof corsInputSchema>;

export type CorsTestId =
  | 'baseline'
  | 'arbitrary-origin'
  | 'null-origin'
  | 'suffix-match'
  | 'prefix-match'
  | 'http-downgrade'
  | 'preflight';

export interface CorsTest {
  id: CorsTestId;
  /** Origin header sent (absent for baseline). */
  origin?: string;
  method: 'GET' | 'OPTIONS';
  status?: number;
  allowOrigin?: string;
  allowCredentials: boolean;
  allowMethods?: string;
  allowHeaders?: string;
  vary?: string;
  verdict: FindingStatus;
  message: string;
  error?: string;
}

export interface CorsOutput {
  url: string;
  tests: CorsTest[];
  findings: Finding[];
}
