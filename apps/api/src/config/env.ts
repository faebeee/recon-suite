import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /**
   * Allow tools to connect to loopback / private / link-local targets.
   * Keep false for any shared deployment (prevents SSRF into internal networks).
   */
  ALLOW_PRIVATE_TARGETS: bool.default(false),
  /**
   * Enable tools that inspect the API host itself (e.g. WiFi scan).
   * Disable for shared deployments: they expose the server's surroundings.
   */
  LOCAL_TOOLS_ENABLED: bool.default(true),
  /** Requests per minute per client across all tool endpoints. */
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
