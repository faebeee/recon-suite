import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  HostScanInterfacesOutput,
  HostScanOutput,
  HostScanParams,
} from '@recon/shared';
import {
  CommandFailedError,
  CommandNotFoundError,
} from '../../core/process/run-command.js';
import { ToolExecService } from '../../core/process/tool-exec.service.js';
import {
  hostScanRange,
  listHostScanInterfaces,
  nmapDiscoveryArgs,
  parseNmapDiscovery,
  pickDefaultHostScanInterface,
} from './host-scan.parsers.js';

/**
 * Discovers live hosts on the subnet of a chosen network interface with an nmap ping sweep
 * (`nmap -sn`: ARP as root, with MAC + vendor) on the API host.
 */

@Injectable()
export class HostScanService {
  /** Concurrent requests for the same interface share one scan (scans take seconds). */
  private readonly inFlight = new Map<string, Promise<HostScanOutput>>();

  constructor(private readonly exec: ToolExecService) {}

  async listInterfaces(): Promise<HostScanInterfacesOutput> {
    const interfaces = listHostScanInterfaces();
    return {
      interfaces,
      defaultInterface: pickDefaultHostScanInterface(interfaces),
    };
  }

  async scan({
    interface: requested,
  }: HostScanParams): Promise<HostScanOutput> {
    const { interfaces, defaultInterface } = await this.listInterfaces();
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
    const { range, limitedFrom } = hostScanRange(cidr);
    const args = nmapDiscoveryArgs(iface, range);
    try {
      // No time limit: the sweep runs until nmap is done.
      const xml = await this.exec.run('nmap', args, { timeoutMs: null });
      const method = `nmap ${args.join(' ')}`;
      return {
        interface: iface,
        network: range,
        limitedFrom,
        method,
        hosts: parseNmapDiscovery(xml),
      };
    } catch (err) {
      throw this.toHttpError(err);
    }
  }

  private toHttpError(err: unknown): unknown {
    if (err instanceof CommandNotFoundError) {
      return new ServiceUnavailableException(
        `${err.message}. Host scanning needs "nmap" on the API host ` +
          '(e.g. "sudo apt install nmap" / "brew install nmap").',
      );
    }
    if (err instanceof CommandFailedError) {
      return new ServiceUnavailableException(
        `nmap failed: ${err.stderr.trim().split(/\r?\n/)[0] || 'unknown error'}` +
          '. ARP discovery needs root (sudo) or the cap_net_raw capability.',
      );
    }
    return err;
  }
}
