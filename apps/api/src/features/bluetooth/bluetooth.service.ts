import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  BluetoothDevice,
  BluetoothOutput,
  BluetoothParams,
} from '@recon/shared';
import {
  HELPER_SETUP_COMMAND,
  helperInstalled,
  runHelper,
} from '../../core/native/macos-helper.js';
import {
  CommandFailedError,
  CommandNotFoundError,
  runCommand,
} from '../../core/process/run-command.js';
import {
  bluetoothctlArgs,
  parseBluetoothctl,
  parseHelperBluetooth,
  parsePairedDevices,
  sortDevices,
  type HelperBluetoothResult,
  type SpBluetoothJson,
} from './bluetooth.parsers.js';

/**
 * Scans for BLE and Classic Bluetooth devices around the API host.
 * macOS: ReconHelper (CoreBluetooth + IOBluetooth), fallback to paired devices.
 * Linux: BlueZ bluetoothctl. Windows: not supported yet.
 */
@Injectable()
export class BluetoothService {
  /** One radio, one scan at a time: concurrent requests share the running scan. */
  private inFlight?: Promise<BluetoothOutput>;

  scan(params: BluetoothParams): Promise<BluetoothOutput> {
    this.inFlight ??= this.scanPlatform(params).finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async scanPlatform(
    params: BluetoothParams,
  ): Promise<BluetoothOutput> {
    try {
      switch (process.platform) {
        case 'darwin':
          return await this.scanMacos(params);
        case 'linux':
          return await this.scanLinux(params);
        default:
          throw new ServiceUnavailableException(
            `Bluetooth scanning is not supported on ${process.platform} yet.`,
          );
      }
    } catch (err) {
      if (err instanceof CommandNotFoundError) {
        throw new ServiceUnavailableException(
          `${err.message}. Bluetooth scanning needs the API to run natively on a machine with a ` +
            'Bluetooth adapter (on Linux it requires BlueZ).',
        );
      }
      if (err instanceof CommandFailedError) {
        throw new ServiceUnavailableException(
          `Bluetooth command failed: ${err.message}`,
        );
      }
      throw err;
    }
  }

  private async scanMacos({
    transport,
    durationSec,
  }: BluetoothParams): Promise<BluetoothOutput> {
    const base = { platform: 'macos' as const, transport, durationSec };
    let reason =
      'macOS only lets apps with Bluetooth permission scan for devices.';

    if (helperInstalled()) {
      const result = await runHelper<HelperBluetoothResult>(
        'bluetooth',
        ['--duration', String(durationSec), '--transport', transport],
        (durationSec + 30) * 1000,
      );
      if (result.authorized) {
        if (result.error) throw new ServiceUnavailableException(result.error);
        return {
          ...base,
          method: methodName(transport),
          devices: sortDevices(parseHelperBluetooth(result)),
          warnings: result.classicError ? [result.classicError] : undefined,
        };
      }
      reason = `ReconHelper has no Bluetooth permission (status: ${result.status}).`;
    }

    const json = JSON.parse(
      await runCommand('system_profiler', ['SPBluetoothDataType', '-json'], {
        timeoutMs: 15_000,
      }),
    ) as SpBluetoothJson;
    return {
      ...base,
      method: 'system_profiler SPBluetoothDataType (paired devices only)',
      devices: sortDevices(parsePairedDevices(json)),
      notice: {
        reason: `${reason} Showing paired devices only, no scan was performed.`,
        fix: helperInstalled()
          ? 'Allow Bluetooth for "ReconHelper" in System Settings > Privacy & Security > Bluetooth, or re-run the setup to get the prompt again.'
          : 'Build the ReconHelper app once and click "Allow" when macOS asks for Bluetooth access.',
        command: HELPER_SETUP_COMMAND,
      },
    };
  }

  private async scanLinux({
    transport,
    durationSec,
  }: BluetoothParams): Promise<BluetoothOutput> {
    // BlueZ scans one transport at a time.
    const transports =
      transport === 'both' ? (['ble', 'classic'] as const) : [transport];
    const devices = new Map<string, BluetoothDevice>();
    for (const t of transports) {
      const text = await runCommand(
        'bluetoothctl',
        bluetoothctlArgs(durationSec, t),
        {
          timeoutMs: (durationSec + 10) * 1000,
        },
      );
      if (/No default controller available/i.test(text)) {
        throw new ServiceUnavailableException(
          'No Bluetooth controller available on the API host.',
        );
      }
      for (const d of parseBluetoothctl(text, t)) {
        const existing = devices.get(d.id);
        devices.set(
          d.id,
          existing ? { ...existing, ...d, name: d.name ?? existing.name } : d,
        );
      }
    }
    return {
      platform: 'linux',
      transport,
      durationSec,
      method: `bluetoothctl scan ${transports.map((t) => (t === 'ble' ? 'le' : 'bredr')).join(' + ')}`,
      devices: sortDevices([...devices.values()]),
    };
  }
}

function methodName(transport: BluetoothParams['transport']): string {
  if (transport === 'ble') return 'CoreBluetooth (ReconHelper)';
  if (transport === 'classic') return 'IOBluetooth inquiry (ReconHelper)';
  return 'CoreBluetooth + IOBluetooth inquiry (ReconHelper)';
}
