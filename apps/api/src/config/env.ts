import { z } from 'zod';

/** Optional value where an empty string means "not set" (compose passes `${VAR:-}`). */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

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
  /**
   * SQLite file for engagements, history, notes and sessions. Relative paths resolve from
   * the working directory; ":memory:" keeps everything in memory (tests).
   */
  DATABASE_PATH: z.string().trim().min(1).default('data/recon.db'),
  /** Login password (plain). Prefer ADMIN_PASSWORD_HASH outside local use. */
  ADMIN_PASSWORD: optional(
    z.string().min(12, 'ADMIN_PASSWORD must be at least 12 characters'),
  ),
  /** scrypt hash of the login password (`pnpm --filter @recon/api hash-password`). */
  ADMIN_PASSWORD_HASH: optional(
    z
      .string()
      .startsWith('$scrypt$', 'ADMIN_PASSWORD_HASH must be a $scrypt$ hash'),
  ),
  /** Static bearer token for scripts (Authorization: Bearer <token>), at least 32 characters. */
  API_TOKEN: optional(
    z.string().min(32, 'API_TOKEN must be at least 32 characters'),
  ),
  /**
   * Mark the session cookie Secure. Browsers accept Secure cookies on http://localhost; set
   * false only when serving the UI over plain HTTP on another host name.
   */
  COOKIE_SECURE: bool.default(true),
  /**
   * Name of a running Kali container. When set, nmap (Host Scan, Nmap Scan) runs inside it via
   * `<CONTAINER_CLI> exec` instead of on the API host. Needs access to the container
   * engine socket, which is root-equivalent on the host (see compose.yaml).
   */
  KALI_CONTAINER: optional(
    z
      .string()
      .trim()
      .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/,
        'Invalid KALI_CONTAINER name',
      ),
  ),
  /**
   * Image to create KALI_CONTAINER from when it does not exist (stopped containers are
   * always started). Only a local image is used (`--pull never`). Unset: never create.
   */
  KALI_IMAGE: optional(
    z
      .string()
      .trim()
      .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,254}$/,
        'Invalid KALI_IMAGE reference',
      ),
  ),
  /** CLI used to reach KALI_CONTAINER (talks to DOCKER_HOST / the default socket). */
  CONTAINER_CLI: z.enum(['docker', 'podman']).default('docker'),
  /** NVD API key for the CVE Lookup tool (https://nvd.nist.gov/developers/request-an-api-key). */
  NVD_API_KEY: optional(z.string().trim().min(1)),
  /** SecurityTrails API key for the Reverse IP tool. */
  SECURITYTRAILS_API_KEY: optional(z.string().trim().min(1)),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
