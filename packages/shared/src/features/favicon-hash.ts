import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';

export const faviconHashInputSchema = z.object({
  target: httpUrlSchema,
});
export type FaviconHashInput = z.input<typeof faviconHashInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type FaviconHashParams = z.output<typeof faviconHashInputSchema>;

/** Icons fetched per run (page links + /favicon.ico). */
export const MAX_FAVICONS = 5;

export interface FaviconResult {
  url: string;
  /** Where the URL came from: a <link rel=icon> on the page, or the /favicon.ico default. */
  source: 'link' | 'default';
  status?: number;
  contentType?: string;
  bytes?: number;
  /** Shodan-style MurmurHash3 (32-bit, signed) of the base64-encoded icon. */
  mmh3?: number;
  md5?: string;
  sha256?: string;
  /** Search queries that find other hosts serving the same icon. */
  queries?: { engine: 'Shodan' | 'FOFA' | 'Censys'; query: string }[];
  error?: string;
}

export interface FaviconHashOutput {
  page: string;
  icons: FaviconResult[];
}
