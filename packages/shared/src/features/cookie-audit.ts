import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding, FindingStatus, Grade } from '../common/finding.js';

export const cookieAuditInputSchema = z.object({
  target: httpUrlSchema,
});
export type CookieAuditInput = z.input<typeof cookieAuditInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type CookieAuditParams = z.output<typeof cookieAuditInputSchema>;

/** Cookies audited per run (the rest is ignored). */
export const MAX_AUDITED_COOKIES = 50;

export type CookieCheckId =
  'secure' | 'httponly' | 'samesite' | 'prefix' | 'domain' | 'lifetime';

export interface CookieCheck {
  id: CookieCheckId;
  status: FindingStatus;
  message: string;
}

export interface AuditedCookie {
  name: string;
  /** Length of the value only: values may be session tokens and are never stored. */
  valueLength: number;
  /** URL of the response that set the cookie (redirect hops included). */
  setBy: string;
  domain?: string;
  path?: string;
  /** Lifetime in seconds from Max-Age or Expires; absent for session cookies. */
  maxAgeSeconds?: number;
  secure: boolean;
  httpOnly: boolean;
  /** Raw SameSite value as sent (Strict, Lax, None, ...). */
  sameSite?: string;
  partitioned: boolean;
  prefix?: '__Host-' | '__Secure-';
  /** Name looks like a session or auth cookie (sess, sid, auth, token, jwt, ...). */
  sensitive: boolean;
  checks: CookieCheck[];
}

export interface CookieAuditHop {
  url: string;
  status: number;
  cookies: number;
}

export interface CookieAuditOutput {
  finalUrl: string;
  hops: CookieAuditHop[];
  cookies: AuditedCookie[];
  /** More cookies were set than MAX_AUDITED_COOKIES. */
  truncated: boolean;
  /** Null when the site sets no cookies (nothing to grade). */
  grade: Grade | null;
  score: number | null;
  findings: Finding[];
}
