import { z } from 'zod';
import { hostSchema, portSchema } from '../common/target.js';

export const tlsInputSchema = z.object({
  target: hostSchema,
  port: portSchema.default(443),
});
export type TlsInput = z.input<typeof tlsInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type TlsParams = z.output<typeof tlsInputSchema>;

export interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  serialNumber: string;
  fingerprint256: string;
  subjectAltNames: string[];
  keyBits?: number;
  selfSigned: boolean;
}

export interface TlsOutput {
  address: string;
  port: number;
  protocol: string | null;
  cipher: { name: string; standardName?: string; version: string };
  authorized: boolean;
  authorizationError?: string;
  certificate: CertificateInfo;
  chain: CertificateInfo[];
}
