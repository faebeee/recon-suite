import { z } from 'zod';

/** OS interface name (eth0, en0, wlan0). Strict: it ends up as a command argument. */
export const hostScanInterfaceNameSchema = z
  .string()
  .trim()
  .regex(/^[\w.:-]{1,64}$/, 'Invalid interface name');

/** Local tool: no target, the scan runs on the API host's local network. */
export const hostScanInputSchema = z.object({
  /** Interface whose subnet to scan; defaults to the first non-virtual IPv4 interface. */
  interface: hostScanInterfaceNameSchema.optional(),
});
export type HostScanInput = z.input<typeof hostScanInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type HostScanParams = z.output<typeof hostScanInputSchema>;

export interface HostScanInterface {
  /** Identifier passed back as `interface` when scanning. */
  name: string;
  address: string;
  netmask: string;
  /** e.g. "192.168.1.5/24" (Node's own CIDR notation for this address). */
  cidr: string;
  macAddress?: string;
}

/** Response of GET /api/tools/host-scan/interfaces */
export interface HostScanInterfacesOutput {
  interfaces: HostScanInterface[];
  /** Interface used when a scan doesn't specify one. */
  defaultInterface?: string;
}

export const HOST_SCAN_INTERFACES_ENDPOINT = '/tools/host-scan/interfaces';

export interface HostScanHost {
  ip: string;
  macAddress: string;
  /** NIC vendor from the MAC's OUI, when arp-scan's database has it. */
  vendor?: string;
}

export interface HostScanOutput {
  interface: string;
  /** Subnet that was scanned, in CIDR notation. */
  network: string;
  /** The OS command used for the scan. */
  method: string;
  hosts: HostScanHost[];
}
