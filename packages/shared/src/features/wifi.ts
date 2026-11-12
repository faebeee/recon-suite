import { z } from 'zod';

/** OS interface name (en0, wlan0, "Wi-Fi 2"). Strict: it ends up as a command argument. */
export const wifiInterfaceNameSchema = z
  .string()
  .trim()
  .regex(/^[\w .:()-]{1,64}$/, 'Invalid interface name');

/** Local tool: no target, the scan runs on the API host. */
export const wifiInputSchema = z.object({
  /** Interface to scan with; defaults to the connected (or first) WiFi interface. */
  interface: wifiInterfaceNameSchema.optional(),
});
export type WifiInput = z.input<typeof wifiInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type WifiParams = z.output<typeof wifiInputSchema>;

export type WifiBand = '2.4 GHz' | '5 GHz' | '6 GHz';

export interface WifiNetwork {
  /** Empty string for hidden or redacted networks. */
  ssid: string;
  hidden: boolean;
  /** The OS withheld the name/BSSID (macOS without Location permission). */
  redacted?: boolean;
  /** Not available on macOS (redacted by the OS). */
  bssid?: string;
  channel?: number;
  band?: WifiBand;
  channelWidthMhz?: number;
  frequencyMhz?: number;
  phyMode?: string;
  /** Human-readable, e.g. "WPA2 Personal", "Open". */
  security: string;
  signalDbm?: number;
  noiseDbm?: number;
  /** Signal quality 0-100 (derived from dBm where needed). */
  quality?: number;
  /** The network this host is connected to. */
  current: boolean;
}

export type WifiPlatform = 'macos' | 'linux' | 'windows';

export interface WifiInterface {
  /** Identifier passed back as `interface` when scanning. */
  name: string;
  /** Human label, e.g. hardware port or adapter description. */
  description?: string;
  macAddress?: string;
  /** OS-reported state, e.g. "connected", "disconnected". */
  state?: string;
  /** Connected network / connection profile, when the OS reports it. */
  connection?: string;
}

/** Response of GET /api/tools/wifi/interfaces */
export interface WifiInterfacesOutput {
  platform: WifiPlatform;
  interfaces: WifiInterface[];
  /** Interface used when a scan doesn't specify one. */
  defaultInterface?: string;
}

export const WIFI_INTERFACES_ENDPOINT = '/tools/wifi/interfaces';

export interface WifiOutput {
  platform: WifiPlatform;
  /** The OS command used for the scan. */
  method: string;
  interface?: string;
  networks: WifiNetwork[];
  /** Set when the OS withheld network names; explains why and how to fix it. */
  redaction?: { reason: string; fix: string; command?: string };
}

/** dBm -> 0-100 quality (-100 dBm = 0, -50 dBm = 100). */
export function dbmToQuality(dbm: number): number {
  return Math.max(0, Math.min(100, 2 * (dbm + 100)));
}

export function bandFromFrequency(mhz: number): WifiBand | undefined {
  if (mhz >= 2400 && mhz < 2500) return '2.4 GHz';
  if (mhz >= 5150 && mhz < 5925) return '5 GHz';
  if (mhz >= 5925 && mhz < 7125) return '6 GHz';
  return undefined;
}
