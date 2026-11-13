import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  HostScanInterface,
  HostScanInterfacesOutput,
  HostScanOutput,
  HostScanParams,
} from '@recon/shared';
import type { Env } from '../../config/env.js';
import {
  CommandFailedError,
  CommandNotFoundError,
} from '../../core/process/run-command.js';
import {
  KALI_HINT,
  KaliUnavailableError,
} from '../../core/process/tool-exec.js';
import { ToolExecService } from '../../core/process/tool-exec.service.js';
import {
  hostScanRange,
  listHostScanInterfaces,
  nmapDiscoveryArgs,
  parseIpAddrJson,
  parseNmapDiscovery,
  pickDefaultHostScanInterface,
} from './host-scan.parsers.js';

/**
 * Discovers live hosts on the subnet of a chosen network interface with an nmap ping sweep
 * (`nmap -sn`: ARP as root, with MAC + vendor). Runs inside the Kali container when
 * KALI_CONTAINER is set (interfaces are then those of the Kali container), else on the API host.
 */

@Injectable()
export class HostScanService {
  private readonly enabled: boolean;
  /** Concurrent requests for the same interface share one scan (scans take seconds). */
  private readonly inFlight = new Map<string, Promise<HostScanOutput>>();

  constructor(
    config: ConfigService<Env, true>,
    private readonly exec: ToolExecService,
  ) {
    this.enabled = config.get('LOCAL_TOOLS_ENABLED', { infer: true });
  }

  async listInterfaces(): Promise<HostScanInterfacesOutput> {
    this.assertEnabled();
    const interfaces = await this.readInterfaces();
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
        method: this.exec.via ? `${this.exec.via} ${method}` : method,
        hosts: parseNmapDiscovery(xml),
      };
    } catch (err) {
      throw this.toHttpError(err);
    }
  }

  private async readInterfaces(): Promise<HostScanInterface[]> {
    if (this.exec.target.kind === 'local') return listHostScanInterfaces();
    try {
      return parseIpAddrJson(
        await this.exec.run('ip', ['-j', 'addr', 'show'], {
          timeoutMs: 5_000,
        }),
      );
    } catch (err) {
      throw this.toHttpError(err);
    }
  }

  private toHttpError(err: unknown): unknown {
    if (err instanceof KaliUnavailableError) {
      return new ServiceUnavailableException(`${err.message}. ${KALI_HINT}`);
    }
    if (err instanceof CommandNotFoundError) {
      return new ServiceUnavailableException(
        this.exec.target.kind === 'kali'
          ? `${err.message} in the Kali container. Rebuild it (pnpm compose:up).`
          : `${err.message}. Host scanning needs "nmap" on the API host ` +
              '(e.g. "sudo apt install nmap" / "brew install nmap"), or a Kali container (KALI_CONTAINER).',
      );
    }
    if (err instanceof CommandFailedError) {
      return new ServiceUnavailableException(
        `nmap failed: ${err.stderr.trim().split(/\r?\n/)[0] || 'unknown error'}` +
          (this.exec.target.kind === 'kali'
            ? '. The Kali container needs the NET_RAW capability (cap_add).'
            : '. ARP discovery needs root (sudo) or the cap_net_raw capability.'),
      );
    }
    return err;
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Local tools are disabled on this server (LOCAL_TOOLS_ENABLED=false).',
      );
    }
  }
}
