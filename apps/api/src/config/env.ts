import { z } from 'zod';

/** Optional value where an empty string means "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /**
   * SQLite file for engagements, history and notes. Relative paths resolve from
   * the working directory; ":memory:" keeps everything in memory (tests).
   */
  DATABASE_PATH: z.string().trim().min(1).default('data/recon.db'),
  /** NVD API key for the CVE Lookup tool (https://nvd.nist.gov/developers/request-an-api-key). */
  NVD_API_KEY: optional(z.string().trim().min(1)),
  /** SecurityTrails API key for the Reverse IP tool. */
  SECURITYTRAILS_API_KEY: optional(z.string().trim().min(1)),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(applyPortOverrides(config));
}

const isSet = (v: unknown): v is string | number =>
  (typeof v === 'string' && v.trim() !== '') || typeof v === 'number';

/**
 * API_PORT and WEB_PORT configure `npm run dev` and `npm start` for both apps at once:
 * API_PORT replaces PORT, and WEB_PORT adds the web app's local origins to CORS_ORIGIN
 * (otherwise the CSRF check would reject the UI). Both win over values from `.env`.
 */
export function applyPortOverrides(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...config };
  if (isSet(config.API_PORT)) out.PORT = String(config.API_PORT).trim();
  if (isSet(config.WEB_PORT)) {
    const port = String(config.WEB_PORT).trim();
    const local = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
    const existing = isSet(config.CORS_ORIGIN)
      ? String(config.CORS_ORIGIN)
          .split(',')
          .map((o) => o.trim())
      : [];
    out.CORS_ORIGIN = [...new Set([...existing, ...local])]
      .filter(Boolean)
      .join(',');
  }
  return out;
}
