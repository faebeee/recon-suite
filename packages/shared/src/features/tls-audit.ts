import { z } from 'zod';
import { hostSchema, portSchema } from '../common/target.js';
import type { GradedReport } from '../common/finding.js';

export const TLS_PROTOCOLS = [
  'TLSv1',
  'TLSv1.1',
  'TLSv1.2',
  'TLSv1.3',
] as const;
export type TlsProtocolVersion = (typeof TLS_PROTOCOLS)[number];

export const tlsAuditInputSchema = z.object({
  target: hostSchema,
  port: portSchema.default(443),
});
export type TlsAuditInput = z.input<typeof tlsAuditInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type TlsAuditParams = z.output<typeof tlsAuditInputSchema>;

export interface TlsProtocolResult {
  version: TlsProtocolVersion;
  supported: boolean;
  error?: string;
}

export type CipherStrength = 'strong' | 'acceptable' | 'weak' | 'insecure';

export interface TlsCipherResult {
  protocol: TlsProtocolVersion;
  /** OpenSSL name. */
  name: string;
  standardName?: string;
  strength: CipherStrength;
  /** Why it is weak/insecure, e.g. "CBC mode", "no forward secrecy", "3DES". */
  notes: string[];
}

export interface TlsAuditOutput {
  address: string;
  port: number;
  protocols: TlsProtocolResult[];
  /** Accepted cipher suites per protocol (TLS 1.3 suites are listed as offered by the server). */
  ciphers: TlsCipherResult[];
  /** Server sent an OCSP response during the handshake. */
  ocspStapling: boolean | null;
  /** Leaf certificate carries embedded SCTs (certificate transparency). */
  certificateTransparency: boolean | null;
  /** Ephemeral key exchange of the best handshake, e.g. "X25519". */
  keyExchange?: string;
  report: GradedReport;
}
