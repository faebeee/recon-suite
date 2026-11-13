import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';

export const techFingerprintInputSchema = z.object({
  target: httpUrlSchema,
});
export type TechFingerprintInput = z.input<typeof techFingerprintInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type TechFingerprintParams = z.output<typeof techFingerprintInputSchema>;

export const TECH_CATEGORIES = [
  'server',
  'language',
  'framework',
  'cms',
  'ecommerce',
  'cdn',
  'hosting',
  'js-library',
  'analytics',
  'security',
] as const;
export type TechCategory = (typeof TECH_CATEGORIES)[number];

export interface TechDetection {
  name: string;
  category: TechCategory;
  version?: string;
  /** high: explicit header/meta; medium: inferred from paths, cookies or markup. */
  confidence: 'high' | 'medium';
  /** What matched, e.g. "header server: nginx/1.25". */
  evidence: string[];
}

export interface TechFingerprintOutput {
  finalUrl: string;
  status: number;
  redirects: number;
  title?: string;
  /** HTML was larger than the read limit; only the start was analysed. */
  truncated: boolean;
  technologies: TechDetection[];
}
