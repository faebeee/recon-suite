import { z } from 'zod';
import type { Finding } from '../common/finding.js';
import { cidrSchema } from '../common/target.js';

/**
 * Subnets up to a /22 (1024 addresses) are swept whole; anything looser is rejected so a
 * single request can't trigger a multi-minute, internet-wide ping sweep.
 */
export const MAX_NETWORK_SCAN_PREFIX = 22;

export const networkScanInputSchema = z.object({
  /** Network/IP in CIDR notation; a bare IP is treated as a /32 (that single host). */
  target: cidrSchema,
});
export type NetworkScanInput = z.input<typeof networkScanInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type NetworkScanParams = z.output<typeof networkScanInputSchema>;

export interface NetworkScanHost {
  ip: string;
  /** Only when nmap could ARP-discover the host (same Ethernet segment, needs raw sockets). */
  macAddress?: string;
  /** NIC vendor from the MAC's OUI, when nmap's database has it. */
  vendor?: string;
  /** Best-effort device category guessed from the vendor name, e.g. "Apple device", "Router/AP". */
  deviceGuess?: string;
}

export interface NetworkScanOutput {
  /** Range that was actually scanned, in CIDR notation. */
  network: string;
  /** The OS command used for the scan. */
  method: string;
  hosts: NetworkScanHost[];
  findings: Finding[];
}
