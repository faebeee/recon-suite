import { z } from 'zod';

const DOMAIN_RE =
  /^(?=.{1,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;

/**
 * Accepts things users typically paste ("https://Example.com/path", "example.com.")
 * and normalises them to a bare lowercase hostname.
 */
export function normalizeHost(value: string): string {
  let v = value.trim().toLowerCase();
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(v)) {
    try {
      v = new URL(v).hostname;
    } catch {
      /* fall through to the regex check */
    }
  }
  v = v.split('/')[0]!.replace(/\.$/, '');
  // Strip brackets of IPv6 literals: [::1] -> ::1
  if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1);
  return v;
}

export const domainSchema = z
  .string()
  .min(1, 'Target is required')
  .transform(normalizeHost)
  .pipe(
    z.string().regex(DOMAIN_RE, 'Expected a domain name, e.g. example.com'),
  );

export const ipSchema = z.union([z.ipv4(), z.ipv6()]);

/** Domain name or IP literal. */
export const hostSchema = z
  .string()
  .min(1, 'Target is required')
  .transform(normalizeHost)
  .pipe(
    z.union([z.ipv4(), z.ipv6(), z.string().regex(DOMAIN_RE)], {
      error: 'Expected a hostname or IP address',
    }),
  );

/** http(s) URL; a missing scheme defaults to https. */
export const httpUrlSchema = z
  .string()
  .trim()
  .min(1, 'URL is required')
  .transform((v) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`))
  .pipe(
    z.url({
      protocol: /^https?$/,
      error: 'Expected an http(s) URL, e.g. https://example.com',
    }),
  );

export const portSchema = z.coerce.number().int().min(1).max(65535);

export function isIpLiteral(value: string): boolean {
  return ipSchema.safeParse(value).success;
}
