import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  WifiInterfacesOutput,
  WifiNetwork,
  WifiOutput,
  WifiParams,
  WifiPlatform,
} from '@recon/shared';
import type { Env } from '../../config/env.js';
import {
  CommandFailedError,
  CommandNotFoundError,
  runCommand,
} from '../../core/process/run-command.js';
import {
  NETSH_ARGS,
  NETSH_INTERFACES_ARGS,
  NMCLI_ARGS,
  NMCLI_DEVICE_ARGS,
  parseHardwarePorts,
  parseNetsh,
  parseNetshInterfaces,
  parseNmcli,
  parseNmcliDevices,
  parseSystemProfiler,
  pickDefaultInterface,
  type SystemProfilerJson,
} from './wifi.parsers.js';

/**
 * Lists WiFi interfaces and the networks they can see, via the OS's own tooling.
 * Works when the API runs natively; containers have no wireless adapter.
 */
@Injectable()
export class WifiService {
  private readonly enabled: boolean;
  /** Concurrent requests for the same interface share one scan (scans take seconds). */
  private readonly inFlight = new Map<string, Promise<WifiOutput>>();

  constructor(config: ConfigService<Env, true>) {
    this.enabled = config.get('LOCAL_TOOLS_ENABLED', { infer: true });
  }

  async listInterfaces(): Promise<WifiInterfacesOutput> {
    this.assertEnabled();
    const platform = currentPlatform();
    const interfaces = await this.withCommandErrors(async () => {
      switch (platform) {
        case 'macos':
          return parseHardwarePorts(
            await runCommand('networksetup', ['-listallhardwareports'], {
              timeoutMs: 5000,
            }),
          );
        case 'linux':
          return parseNmcliDevices(
            await runCommand('nmcli', NMCLI_DEVICE_ARGS, { timeoutMs: 5000 }),
          );
        case 'windows':
          return parseNetshInterfaces(
            await runCommand('netsh', NETSH_INTERFACES_ARGS, {
              timeoutMs: 5000,
            }),
          );
      }
    });
    return {
      platform,
      interfaces,
      defaultInterface: pickDefaultInterface(interfaces),
    };
  }

  async scan({ interface: requested }: WifiParams): Promise<WifiOutput> {
    const { interfaces, defaultInterface } = await this.listInterfaces();
    if (!interfaces.length) {
      throw new ServiceUnavailableException(
        'No WiFi interface found on the API host.',
      );
    }
    // Allowlist: only names the OS reported are ever passed to a command.
    if (requested && !interfaces.some((i) => i.name === requested)) {
      throw new BadRequestException(
        `Unknown WiFi interface "${requested}". Available: ${interfaces.map((i) => i.name).join(', ')}`,
      );
    }
    const iface = requested ?? defaultInterface!;

    let pending = this.inFlight.get(iface);
    if (!pending) {
      pending = this.scanInterface(iface).finally(() =>
        this.inFlight.delete(iface),
      );
      this.inFlight.set(iface, pending);
    }
    return pending;
  }

  private scanInterface(iface: string): Promise<WifiOutput> {
    return this.withCommandErrors(async () => {
      switch (currentPlatform()) {
        case 'macos': {
          // system_profiler has no interface flag; it reports every interface and we pick one.
          const json = JSON.parse(
            await runCommand('system_profiler', ['SPAirPortDataType', '-json']),
          ) as SystemProfilerJson;
          const { networks } = parseSystemProfiler(json, iface);
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
            method: `nmcli device wifi list ifname ${iface}`,
            interface: iface,
            networks: sort(
              parseNmcli(
                await runCommand('nmcli', [...NMCLI_ARGS, 'ifname', iface]),
              ),
            ),
          };
        case 'windows':
          return {
            platform: 'windows',
            method: `netsh wlan show networks interface="${iface}"`,
            interface: iface,
            networks: sort(
              parseNetsh(
                await runCommand('netsh', [
                  ...NETSH_ARGS,
                  `interface=${iface}`,
                ]),
              ),
            ),
          };
      }
    });
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Local tools are disabled on this server (LOCAL_TOOLS_ENABLED=false).',
      );
    }
  }

  private async withCommandErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof CommandNotFoundError) {
        throw new ServiceUnavailableException(
          `${err.message}. WiFi scanning needs the API to run natively on a machine with a wireless adapter ` +
            '(it is not available inside containers; on Linux it requires NetworkManager).',
        );
      }
      if (err instanceof CommandFailedError) {
        throw new ServiceUnavailableException(
          `WiFi command failed: ${err.message}`,
        );
      }
      throw err;
    }
  }
}

function currentPlatform(): WifiPlatform {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    default:
      throw new ServiceUnavailableException(
        `WiFi scanning is not supported on ${process.platform}.`,
      );
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
