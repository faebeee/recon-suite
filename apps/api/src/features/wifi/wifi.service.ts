import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WifiNetwork, WifiOutput } from '@recon/shared';
import type { Env } from '../../config/env.js';
import {
  CommandFailedError,
  CommandNotFoundError,
  runCommand,
} from '../../core/process/run-command.js';
import {
  NETSH_ARGS,
  NMCLI_ARGS,
  parseNetsh,
  parseNmcli,
  parseSystemProfiler,
  type SystemProfilerJson,
} from './wifi.parsers.js';

/**
 * Lists WiFi networks visible to the API host via the OS's own tooling.
 * Works when the API runs natively; containers have no wireless adapter.
 */
@Injectable()
export class WifiService {
  private readonly enabled: boolean;
  /** Concurrent requests share one scan (scans take a few seconds). */
  private inFlight?: Promise<WifiOutput>;

  constructor(config: ConfigService<Env, true>) {
    this.enabled = config.get('LOCAL_TOOLS_ENABLED', { infer: true });
  }

  scan(): Promise<WifiOutput> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Local tools are disabled on this server (LOCAL_TOOLS_ENABLED=false).',
      );
    }
    this.inFlight ??= this.scanPlatform().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async scanPlatform(): Promise<WifiOutput> {
    try {
      switch (process.platform) {
        case 'darwin': {
          const json = JSON.parse(
            await runCommand('system_profiler', ['SPAirPortDataType', '-json']),
          ) as SystemProfilerJson;
          const { interface: iface, networks } = parseSystemProfiler(json);
          return {
            platform: 'macos',
            method: 'system_profiler SPAirPortDataType',
            interface: iface,
            networks: sort(networks),
          };
        }
        case 'linux':
          return {
            platform: 'linux',
            method: 'nmcli device wifi list',
            networks: sort(parseNmcli(await runCommand('nmcli', NMCLI_ARGS))),
          };
        case 'win32':
          return {
            platform: 'windows',
            method: 'netsh wlan show networks',
            networks: sort(parseNetsh(await runCommand('netsh', NETSH_ARGS))),
          };
        default:
          throw new ServiceUnavailableException(
            `WiFi scanning is not supported on ${process.platform}.`,
          );
      }
    } catch (err) {
      if (err instanceof CommandNotFoundError) {
        throw new ServiceUnavailableException(
          `${err.message}. WiFi scanning needs the API to run natively on a machine with a wireless adapter ` +
            '(it is not available inside containers; on Linux it requires NetworkManager).',
        );
      }
      if (err instanceof CommandFailedError) {
        throw new ServiceUnavailableException(
          `WiFi scan failed: ${err.message}`,
        );
      }
      throw err;
    }
  }
}

/** Connected network first, then strongest signal first, unknown signal last. */
function sort(networks: WifiNetwork[]): WifiNetwork[] {
  return [...networks].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      (b.quality ?? -1) - (a.quality ?? -1) ||
      a.ssid.localeCompare(b.ssid),
  );
}
