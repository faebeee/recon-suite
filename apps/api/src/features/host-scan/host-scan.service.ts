import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  HostScanInterfacesOutput,
  HostScanOutput,
  HostScanParams,
} from '@recon/shared';
import type { Env } from '../../config/env.js';
import {
  CommandFailedError,
  CommandNotFoundError,
  runCommand,
} from '../../core/process/run-command.js';
import {
  ARP_SCAN_ARGS,
  listHostScanInterfaces,
  parseArpScan,
  pickDefaultHostScanInterface,
} from './host-scan.parsers.js';

/**
 * ARP-discovers hosts on the subnet of a chosen network interface, via `arp-scan`.
 * Needs the API to run natively (not in a container) with root or cap_net_raw.
 */
@Injectable()
export class HostScanService {
  private readonly enabled: boolean;
  /** Concurrent requests for the same interface share one scan (scans take seconds). */
  private readonly inFlight = new Map<string, Promise<HostScanOutput>>();

  constructor(config: ConfigService<Env, true>) {
    this.enabled = config.get('LOCAL_TOOLS_ENABLED', { infer: true });
  }

  listInterfaces(): HostScanInterfacesOutput {
    this.assertEnabled();
    const interfaces = listHostScanInterfaces();
    return {
      interfaces,
      defaultInterface: pickDefaultHostScanInterface(interfaces),
    };
  }

  async scan({
    interface: requested,
  }: HostScanParams): Promise<HostScanOutput> {
    const { interfaces, defaultInterface } = this.listInterfaces();
    if (!interfaces.length) {
      throw new ServiceUnavailableException(
        'No usable network interface found on the API host.',
      );
    }
    // Allowlist: only interfaces the OS reported are ever passed to a command.
    const iface = interfaces.find(
      (i) => i.name === (requested ?? defaultInterface),
    );
    if (!iface) {
      throw new BadRequestException(
        `Unknown interface "${requested}". Available: ${interfaces.map((i) => i.name).join(', ')}`,
      );
    }

    let pending = this.inFlight.get(iface.name);
    if (!pending) {
      pending = this.scanInterface(iface.name, iface.cidr).finally(() =>
        this.inFlight.delete(iface.name),
      );
      this.inFlight.set(iface.name, pending);
    }
    return pending;
  }

  private async scanInterface(
    iface: string,
    cidr: string,
  ): Promise<HostScanOutput> {
    try {
      const text = await runCommand(
        'arp-scan',
        [...ARP_SCAN_ARGS, `--interface=${iface}`],
        { timeoutMs: 30_000 },
      );
      return {
        interface: iface,
        network: cidr,
        method: `arp-scan --localnet --interface=${iface}`,
        hosts: parseArpScan(text),
      };
    } catch (err) {
      if (err instanceof CommandNotFoundError) {
        throw new ServiceUnavailableException(
          `${err.message}. Host scanning needs "arp-scan" installed on the API host ` +
            '(e.g. "apt install arp-scan" / "brew install arp-scan").',
        );
      }
      if (err instanceof CommandFailedError) {
        throw new ServiceUnavailableException(
          `arp-scan failed: ${err.message}. It usually needs root privileges or the ` +
            'cap_net_raw capability (sudo setcap cap_net_raw+ep "$(which arp-scan)").',
        );
      }
      throw err;
    }
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Local tools are disabled on this server (LOCAL_TOOLS_ENABLED=false).',
      );
    }
  }
}
