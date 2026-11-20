import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

export const httpMethodsInputSchema = z.object({
  target: httpUrlSchema,
});
export type HttpMethodsInput = z.input<typeof httpMethodsInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type HttpMethodsParams = z.output<typeof httpMethodsInputSchema>;

/** OPTIONS request: methods the server advertises (nothing state-changing is ever sent). */
export interface MethodsProbe {
  status?: number;
  /** From `Allow` (or `Access-Control-Allow-Methods` when Allow is missing). */
  allowed: string[];
  /** Allowed methods worth a look (TRACE, PUT, DELETE, ...). */
  risky: string[];
  error?: string;
}

/** TRACE request with a marker header; reflected = the marker came back in the body. */
export interface TraceProbe {
  status?: number;
  reflected: boolean;
  error?: string;
}

/** Plain-HTTP request to the host: should redirect to HTTPS. */
export interface HttpsRedirectProbe {
  url: string;
  status?: number;
  location?: string;
  redirectsToHttps: boolean;
  error?: string;
}

export interface HstsInfo {
  header?: string;
  maxAge?: number;
  includeSubDomains: boolean;
  preload: boolean;
  /** hstspreload.org status of the host or a parent domain (absent if the lookup failed). */
  preloadList?: { domain: string; status: string; includeSubDomains?: boolean };
}

/** Request to a random non-existent path: error page leaks and soft 404s. */
export interface ErrorPageProbe {
  url: string;
  status?: number;
  /** Version banners, stack traces or framework debug pages found in the body or headers. */
  leaks: string[];
  /** Server answered 200 for a path that can't exist. */
  soft404: boolean;
  error?: string;
}

export interface HttpMethodsOutput {
  /** URL after redirects; all probes except the HTTPS redirect hit this one. */
  url: string;
  status: number;
  options: MethodsProbe;
  trace: TraceProbe;
  httpsRedirect: HttpsRedirectProbe;
  hsts: HstsInfo;
  errorPage: ErrorPageProbe;
  /** Out-of-the-box page of a server product (e.g. "nginx welcome page"). */
  defaultPage?: string;
  findings: Finding[];
}
