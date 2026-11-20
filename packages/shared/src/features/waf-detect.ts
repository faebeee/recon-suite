import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

export const wafDetectInputSchema = z.object({
  target: httpUrlSchema,
  /**
   * Also send one request with a harmless attack-looking query string (like wafw00f), which
   * many WAFs answer with a block page. Nothing is exploited; turn off to send only a plain GET.
   */
  probe: z.boolean().default(true),
});
export type WafDetectInput = z.input<typeof wafDetectInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type WafDetectParams = z.output<typeof wafDetectInputSchema>;

/** cdn: edge network/cache; waf: request filtering; platform: hosting edge (Vercel, Netlify). */
export type EdgeKind = 'cdn' | 'waf' | 'platform';

export interface EdgeDetection {
  name: string;
  kinds: EdgeKind[];
  /** Headers, cookies or page text that matched, e.g. "cf-ray header". */
  evidence: string[];
  /** Seen only in the answer to the trigger request (typical for block pages). */
  probeOnly: boolean;
}

export interface WafResponse {
  url: string;
  status?: number;
  server?: string;
  error?: string;
}

export interface WafDetectOutput {
  finalUrl: string;
  baseline: WafResponse;
  /** Absent when `probe` was off. */
  probe?: WafResponse & {
    /** The trigger request was answered differently than the plain one (403, 406, ...). */
    blocked: boolean;
  };
  detections: EdgeDetection[];
  findings: Finding[];
}
