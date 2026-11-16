import { z } from 'zod';
import { hostSchema } from '../common/target.js';
import type { Finding } from '../common/finding.js';

/** Max addresses looked up when a domain resolves to many IPs. */
export const MAX_EXPOSURE_ADDRESSES = 8;

export const passiveExposureInputSchema = z.object({
  /** IP address, or a domain whose A/AAAA records are looked up. */
  target: hostSchema,
});
export type PassiveExposureInput = z.input<typeof passiveExposureInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type PassiveExposureParams = z.output<typeof passiveExposureInputSchema>;

/** A port that is commonly risky when reachable from the internet. */
export interface RiskyPort {
  port: number;
  service: string;
}

export interface ExposureAddress {
  ip: string;
  /** The IP is in Shodan's index (InternetDB returns no data otherwise). */
  indexed: boolean;
  ports: number[];
  risky: RiskyPort[];
  /** Products/versions as CPE 2.3 strings, e.g. "cpe:/a:nginx:nginx:1.18.0". */
  cpes: string[];
  hostnames: string[];
  /** Shodan tags, e.g. "cdn", "cloud", "self-signed", "eol-product". */
  tags: string[];
  /** CVE ids Shodan matched from banner versions (unverified). */
  vulns: string[];
  /** Lookup failed for this address (others still succeeded). */
  error?: string;
}

export interface PassiveExposureOutput {
  query: string;
  kind: 'ip' | 'domain';
  /** Total addresses the domain resolved to (may exceed what was looked up). */
  resolvedCount: number;
  /** Data source, shown in the UI for attribution. */
  source: 'Shodan InternetDB';
  addresses: ExposureAddress[];
  findings: Finding[];
}
