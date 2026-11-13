import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

export const MAX_JS_SCRIPTS = 30;

export const jsEndpointsInputSchema = z.object({
  target: httpUrlSchema,
  /** Same-site scripts to download and analyse. */
  maxScripts: z.number().int().min(1).max(MAX_JS_SCRIPTS).default(15),
});
export type JsEndpointsInput = z.input<typeof jsEndpointsInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type JsEndpointsParams = z.output<typeof jsEndpointsInputSchema>;

export interface JsScript {
  url: string;
  /** Same site as the target (downloaded and analysed) or third party (listed only). */
  external: boolean;
  status?: number;
  bytes?: number;
  truncated?: boolean;
  /** sourceMappingURL found in the script. */
  sourceMap?: string;
  /** The source map URL answered 200 (source code is downloadable). */
  sourceMapExposed?: boolean;
  error?: string;
}

export interface JsEndpoint {
  value: string;
  kind: 'path' | 'url';
  /** Script URLs it was found in (max 3). */
  sources: string[];
}

export interface JsSecret {
  /** e.g. "AWS access key", "Google API key", "JWT", "private key". */
  type: string;
  /** Masked: first and last 4 characters only. */
  masked: string;
  source: string;
}

export interface JsEndpointsOutput {
  page: string;
  scripts: JsScript[];
  /** Capped at 500. */
  endpoints: JsEndpoint[];
  /** Distinct hostnames referenced in scripts. */
  hosts: string[];
  secrets: JsSecret[];
  findings: Finding[];
}
