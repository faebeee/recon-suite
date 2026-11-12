import { z } from 'zod';
import type { HostNotice } from '../common/tool.js';
import type { WifiPlatform } from './wifi.js';

export const BLUETOOTH_SCAN_TRANSPORTS = ['both', 'ble', 'classic'] as const;
export type BluetoothScanTransport = (typeof BLUETOOTH_SCAN_TRANSPORTS)[number];

export const BLUETOOTH_DURATIONS = [4, 8, 12, 20] as const;

/** Local tool: no target, the scan runs on the API host. */
export const bluetoothInputSchema = z.object({
  transport: z.enum(BLUETOOTH_SCAN_TRANSPORTS).default('both'),
  durationSec: z.number().int().min(2).max(20).default(8),
});
export type BluetoothInput = z.input<typeof bluetoothInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type BluetoothParams = z.output<typeof bluetoothInputSchema>;

/** `unknown` for paired devices where the OS doesn't say. */
export type BluetoothTransport = 'ble' | 'classic' | 'unknown';

export interface BluetoothDevice {
  /** MAC address, or a per-host UUID for BLE on macOS (Apple hides BLE MACs). */
  id: string;
  address?: string;
  name?: string;
  transport: BluetoothTransport;
  rssi?: number;
  /** 0-100 derived from RSSI. */
  quality?: number;
  connectable?: boolean;
  txPower?: number;
  manufacturerId?: number;
  manufacturer?: string;
  services?: string[];
  /** Device class / type, e.g. "Audio/Video", "Headphones". */
  deviceClass?: string;
  paired?: boolean;
  connected?: boolean;
  /** Seen during this scan (false: only known from the paired-devices list). */
  discovered: boolean;
}

export interface BluetoothOutput {
  platform: WifiPlatform;
  method: string;
  transport: BluetoothScanTransport;
  durationSec: number;
  devices: BluetoothDevice[];
  /** Degraded result (e.g. missing permission): why and how to fix it. */
  notice?: HostNotice;
  /** Non-fatal problems, e.g. the Classic inquiry failed but BLE worked. */
  warnings?: string[];
}

/** Bluetooth SIG company identifiers (subset of the assigned numbers). */
export const BLUETOOTH_COMPANIES: Record<number, string> = {
  0x0002: 'Intel',
  0x0006: 'Microsoft',
  0x000f: 'Broadcom',
  0x004c: 'Apple',
  0x0059: 'Nordic Semiconductor',
  0x0075: 'Samsung',
  0x0087: 'Garmin',
  0x009e: 'Bose',
  0x00e0: 'Google',
  0x012d: 'Sony',
};

export function bluetoothCompany(id: number): string {
  return BLUETOOTH_COMPANIES[id] ?? `0x${id.toString(16).padStart(4, '0')}`;
}

/** Major device classes of the Bluetooth Classic "Class of Device" field. */
export const BLUETOOTH_MAJOR_CLASSES: Record<number, string> = {
  0: 'Miscellaneous',
  1: 'Computer',
  2: 'Phone',
  3: 'Network',
  4: 'Audio/Video',
  5: 'Peripheral',
  6: 'Imaging',
  7: 'Wearable',
  8: 'Toy',
  9: 'Health',
  31: 'Uncategorized',
};

/** RSSI -> 0-100 (-100 dBm = 0, -40 dBm = 100). */
export function rssiToQuality(rssi: number): number {
  return Math.round(Math.max(0, Math.min(100, ((rssi + 100) * 100) / 60)));
}
