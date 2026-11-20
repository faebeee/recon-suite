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
  return envSchema.parse(config);
}
