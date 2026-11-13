import {
  BadRequestException,
  GatewayTimeoutException,
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
  ARP_SCAN_ARGS,
  listHostScanInterfaces,
  parseArpScan,
  parseIpAddrJson,
  pickDefaultHostScanInterface,
} from './host-scan.parsers.js';

/**
 * ARP-discovers hosts on the subnet of a chosen network interface, via `arp-scan`.
 * Runs on the API host (root or cap_net_raw), or inside the Kali container when
 * KALI_CONTAINER is set; interfaces are then those of the Kali container.
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
    try {
      const text = await this.exec.run(
        'arp-scan',
        [...ARP_SCAN_ARGS, `--interface=${iface}`],
        { timeoutMs: 30_000 },
      );
      const method = `arp-scan --localnet --interface=${iface}`;
      return {
        interface: iface,
        network: cidr,
        method: this.exec.via ? `${this.exec.via} ${method}` : method,
        hosts: parseArpScan(text),
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
          : `${err.message}. Host scanning needs "arp-scan" installed on the API host ` +
              '(e.g. "apt install arp-scan" / "brew install arp-scan"), or a Kali container (KALI_CONTAINER).',
      );
    }
    if (err instanceof CommandFailedError && err.timedOut) {
      return new GatewayTimeoutException(
        'arp-scan did not finish within 30 s. Large subnets (e.g. a /16 container bridge) take ' +
          'too long; scan an interface with a smaller subnet.',
      );
    }
    if (err instanceof CommandFailedError) {
      return new ServiceUnavailableException(
        this.exec.target.kind === 'kali'
          ? `${err.message}. The Kali container needs the NET_RAW capability (cap_add).`
          : `arp-scan failed: ${err.message}. It usually needs root privileges or the ` +
              'cap_net_raw capability (sudo setcap cap_net_raw+ep "$(which arp-scan)").',
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
