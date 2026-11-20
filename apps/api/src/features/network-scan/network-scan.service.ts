import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MAX_NETWORK_SCAN_PREFIX } from '@recon/shared';
import type { NetworkScanOutput, NetworkScanParams } from '@recon/shared';
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
  networkScanArgs,
  networkScanFindings,
  parseCidr,
  parseNetworkScan,
} from './network-scan.parsers.js';

/**
 * Discovers live hosts on a user-supplied network/IP/subnet with an nmap ping sweep
 * (`nmap -sn`: ARP + MAC/vendor as root, falling back to TCP probes otherwise). Runs
 * in the Kali container when KALI_CONTAINER is set, else on the API host.
 * No time limit and no cap on parallel scans: a sweep runs until nmap is done.
 */
@Injectable()
export class NetworkScanService {
  constructor(private readonly exec: ToolExecService) {}

  async scan({ target }: NetworkScanParams): Promise<NetworkScanOutput> {
    const { network, prefix } = parseCidr(target);

    if (prefix < MAX_NETWORK_SCAN_PREFIX) {
      throw new BadRequestException(
        `Network too large: "${target}" is a /${prefix}. Scan a /${MAX_NETWORK_SCAN_PREFIX} ` +
          `or smaller (at most ${2 ** (32 - MAX_NETWORK_SCAN_PREFIX)} addresses).`,
      );
    }
    const range = `${network}/${prefix}`;
    const args = networkScanArgs(range);

    try {
      const xml = await this.exec.run('nmap', args, { timeoutMs: null });
      const hosts = parseNetworkScan(xml);
      const method = `nmap ${args.join(' ')}`;
      return {
        network: range,
        method: this.exec.via ? `${this.exec.via} ${method}` : method,
        runner: this.exec.target.kind,
        hosts,
        findings: networkScanFindings(range, hosts),
      };
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
          ? 'nmap is not installed in the Kali container. Rebuild it (pnpm compose:up).'
          : 'nmap is not installed on the API host. Install it (e.g. "brew install nmap" / ' +
              '"sudo apt install nmap") or run it in a Kali container (KALI_CONTAINER).',
      );
    }
    if (err instanceof CommandFailedError) {
      return new BadGatewayException(
        `nmap failed: ${err.stderr.trim().split(/\r?\n/)[0] || 'unknown error'}` +
          (this.exec.target.kind === 'kali'
            ? '. The Kali container needs the NET_RAW capability (cap_add).'
            : '. ARP discovery needs root (sudo) or the cap_net_raw capability.'),
      );
    }
    return err;
  }
}
