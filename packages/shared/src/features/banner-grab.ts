import { z } from 'zod';
import { hostSchema, portSchema } from '../common/target.js';

export const MAX_BANNER_PORTS = 16;

/** Ports where the server speaks first, so one passive read gets a banner. */
export const BANNER_DEFAULT_PORTS = [
  21, 22, 25, 110, 143, 465, 587, 993, 995, 3306,
];

/** Ports where the banner only comes after a TLS handshake (implicit TLS). */
export const IMPLICIT_TLS_PORTS = [465, 636, 993, 995];

export const bannerGrabInputSchema = z.object({
  target: hostSchema,
  ports: z
    .array(portSchema)
    .min(1)
    .max(MAX_BANNER_PORTS)
    .default([...BANNER_DEFAULT_PORTS]),
  timeoutMs: z.number().int().min(500).max(8000).default(3000),
});
export type BannerGrabInput = z.input<typeof bannerGrabInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type BannerGrabParams = z.output<typeof bannerGrabInputSchema>;

/**
 * banner: the server sent data. silent: connected but nothing within the timeout
 * (the service waits for the client). closed/filtered: like the Port Probe.
 */
export type BannerState = 'banner' | 'silent' | 'closed' | 'filtered' | 'error';

export interface BannerResult {
  port: number;
  state: BannerState;
  tls: boolean;
  /** Printable excerpt of what the server sent (max 512 chars, control chars escaped). */
  banner?: string;
  /** Guessed protocol, e.g. "ssh", "smtp", "ftp", "mysql". */
  service?: string;
  product?: string;
  version?: string;
  error?: string;
}

export interface BannerGrabOutput {
  address: string;
  results: BannerResult[];
}
