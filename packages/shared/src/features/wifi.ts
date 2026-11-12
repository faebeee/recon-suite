import { z } from 'zod';

/** Local tool: no target, the scan runs on the API host. */
export const wifiInputSchema = z.object({});
export type WifiInput = z.input<typeof wifiInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type WifiParams = z.output<typeof wifiInputSchema>;

export type WifiBand = '2.4 GHz' | '5 GHz' | '6 GHz';

export interface WifiNetwork {
  /** Empty string for hidden networks. */
  ssid: string;
  hidden: boolean;
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

export interface WifiOutput {
  platform: WifiPlatform;
  /** The OS command used for the scan. */
  method: string;
  interface?: string;
  networks: WifiNetwork[];
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
