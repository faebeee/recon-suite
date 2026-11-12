import {
  BLUETOOTH_MAJOR_CLASSES,
  bluetoothCompany,
  rssiToQuality,
  type BluetoothDevice,
  type BluetoothTransport,
} from '@recon/shared';
import type { HelperStatus } from '../../core/native/macos-helper.js';

function withQuality(d: BluetoothDevice): BluetoothDevice {
  return d.rssi !== undefined ? { ...d, quality: rssiToQuality(d.rssi) } : d;
}

// ---------------------------------------------------------------- macOS ReconHelper
// JSON written by native/macos/ReconHelper --mode bluetooth (see Bluetooth.swift).

export interface HelperBluetoothResult extends HelperStatus {
  classicError?: string;
  devices?: {
    id: string;
    address?: string;
    transport: 'ble' | 'classic';
    name?: string;
    rssi?: number;
    connectable?: boolean;
    txPower?: number;
    manufacturerId?: number;
    services?: string[];
    majorClass?: number;
    paired?: boolean;
    connected?: boolean;
    /** Classic only; BLE entries are always discovered. */
    discovered?: boolean;
  }[];
}

export function parseHelperBluetooth(
  result: HelperBluetoothResult,
): BluetoothDevice[] {
  return (result.devices ?? []).map((d) =>
    withQuality({
      id: d.id,
      address: d.address,
      name: d.name,
      transport: d.transport,
      rssi: d.rssi,
      connectable: d.connectable,
      txPower: d.txPower,
      manufacturerId: d.manufacturerId,
      manufacturer:
        d.manufacturerId !== undefined
          ? bluetoothCompany(d.manufacturerId)
          : undefined,
      services: d.services?.length ? d.services : undefined,
      deviceClass:
        d.majorClass !== undefined
          ? BLUETOOTH_MAJOR_CLASSES[d.majorClass]
          : undefined,
      paired: d.paired,
      connected: d.connected,
      discovered: d.discovered ?? true,
    }),
  );
}

// ---------------------------------------------------------------- macOS fallback
// `system_profiler SPBluetoothDataType -json`: paired devices only, no scanning.

interface SpBtDevice {
  device_address?: string;
  device_minorType?: string;
  device_rssi?: string | number;
}

export interface SpBluetoothJson {
  SPBluetoothDataType?: {
    device_connected?: Record<string, SpBtDevice>[];
    device_not_connected?: Record<string, SpBtDevice>[];
  }[];
}

export function parsePairedDevices(json: SpBluetoothJson): BluetoothDevice[] {
  const out: BluetoothDevice[] = [];
  for (const top of json.SPBluetoothDataType ?? []) {
    for (const [list, connected] of [
      [top.device_connected, true],
      [top.device_not_connected, false],
    ] as const) {
      for (const entry of list ?? []) {
        for (const [name, d] of Object.entries(entry)) {
          const rssi = Number.parseInt(String(d.device_rssi ?? ''), 10);
          out.push(
            withQuality({
              id: d.device_address ?? name,
              address: d.device_address,
              name,
              transport: 'unknown',
              rssi: Number.isNaN(rssi) ? undefined : rssi,
              deviceClass: d.device_minorType,
              paired: true,
              connected,
              discovered: false,
            }),
          );
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- Linux (BlueZ)
// `bluetoothctl --timeout <s> scan le|bredr` streams [NEW]/[CHG] Device lines.

export function bluetoothctlArgs(
  durationSec: number,
  transport: 'ble' | 'classic',
): string[] {
  return [
    '--timeout',
    String(durationSec),
    'scan',
    transport === 'ble' ? 'le' : 'bredr',
  ];
}

// Strip ANSI colours and readline prompt markers.
// eslint-disable-next-line no-control-regex
const NOISE = /\x1b\[[0-9;]*[A-Za-z]|[\x01\x02]/g;
const LINE =
  /\[(NEW|CHG)\]\s+Device\s+([0-9A-F]{2}(?::[0-9A-F]{2}){5})\s*(.*)$/i;

export function parseBluetoothctl(
  text: string,
  transport: BluetoothTransport,
): BluetoothDevice[] {
  const devices = new Map<string, BluetoothDevice>();
  for (const raw of text.split('\n')) {
    const m = LINE.exec(raw.replace(NOISE, ''));
    if (!m) continue;
    const [, kind, address, rest = ''] = m as unknown as [
      string,
      string,
      string,
      string?,
    ];
    const id = address.toUpperCase();
    const d = devices.get(id) ?? {
      id,
      address: id,
      transport,
      discovered: true,
    };

    if (kind.toUpperCase() === 'NEW') {
      const name = rest.trim();
      // BlueZ uses the address (with dashes) as placeholder name.
      if (name && name.replace(/-/g, ':').toUpperCase() !== id) d.name = name;
    } else {
      let v: RegExpExecArray | null;
      if ((v = /^RSSI:\s*(?:0x[0-9a-f]+\s*\((-?\d+)\)|(-?\d+))/i.exec(rest)))
        d.rssi = Number(v[1] ?? v[2]);
      else if ((v = /^(?:Name|Alias):\s*(.+)$/.exec(rest)))
        d.name ??= v[1]!.trim();
      else if (
        (v = /^TxPower:\s*(?:0x[0-9a-f]+\s*\((-?\d+)\)|(-?\d+))/i.exec(rest))
      )
        d.txPower = Number(v[1] ?? v[2]);
      else if ((v = /^ManufacturerData Key:\s*0x([0-9a-f]+)/i.exec(rest))) {
        d.manufacturerId = Number.parseInt(v[1]!, 16);
        d.manufacturer = bluetoothCompany(d.manufacturerId);
      } else if ((v = /^Paired:\s*(yes|no)/.exec(rest)))
        d.paired = v[1] === 'yes';
      else if ((v = /^Connected:\s*(yes|no)/.exec(rest)))
        d.connected = v[1] === 'yes';
    }
    devices.set(id, d);
  }
  return [...devices.values()].map(withQuality);
}

/** Strongest first, then named before unnamed, then by name/id. */
export function sortDevices(devices: BluetoothDevice[]): BluetoothDevice[] {
  return [...devices].sort(
    (a, b) =>
      Number(b.connected ?? false) - Number(a.connected ?? false) ||
      Number(b.discovered) - Number(a.discovered) ||
      (b.rssi ?? -999) - (a.rssi ?? -999) ||
      Number(!!b.name) - Number(!!a.name) ||
      (a.name ?? a.id).localeCompare(b.name ?? b.id),
  );
}
