import { z } from 'zod';
import { httpUrlSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

/** Well-known files the tool fetches from the target's origin. */
export const WEB_FILES = [
  'robots.txt',
  'sitemap.xml',
  'security.txt',
  'humans.txt',
] as const;
export type WebFileName = (typeof WEB_FILES)[number];

export const webFilesInputSchema = z.object({
  /** Any URL or bare domain; only its origin is used. */
  target: httpUrlSchema,
});
export type WebFilesInput = z.input<typeof webFilesInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type WebFilesParams = z.output<typeof webFilesInputSchema>;

export interface WebFileFetch {
  file: WebFileName;
  /** URL requested first. */
  url: string;
  /** URL after redirects. */
  finalUrl?: string;
  status?: number;
  found: boolean;
  /** 200 with an HTML page where a text/XML file was expected. */
  soft404?: boolean;
  contentType?: string;
  bytes?: number;
  error?: string;
}

export interface RobotsGroup {
  userAgents: string[];
  allow: string[];
  disallow: string[];
  crawlDelay?: string;
}

export interface RobotsReport {
  groups: RobotsGroup[];
  sitemaps: string[];
  /** Disallowed/allowed paths that hint at admin areas, backups, APIs, ... */
  interesting: string[];
}

export interface SitemapReport {
  url: string;
  kind: 'urlset' | 'sitemapindex' | 'unknown';
  /** <loc> entries in the document. */
  count: number;
  /** First entries (capped). */
  sample: string[];
}

export interface SecurityTxtReport {
  fields: { name: string; value: string }[];
  signed: boolean;
  findings: Finding[];
}

export interface WebFilesOutput {
  origin: string;
  files: WebFileFetch[];
  robots?: RobotsReport;
  sitemap?: SitemapReport;
  securityTxt?: SecurityTxtReport;
  humans?: { preview: string; truncated: boolean };
}
