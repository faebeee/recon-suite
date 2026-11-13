import {
  BadRequestException,
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAX_NETWORK_SCAN_PREFIX } from '@recon/shared';
import type { NetworkScanOutput, NetworkScanParams } from '@recon/shared';
import type { Env } from '../../config/env.js';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
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

const SCAN_TIMEOUT_MS = 90_000;
/** A ping sweep is heavy; more parallel scans than this are refused with 429. */
export const MAX_CONCURRENT_NETWORK_SCANS = 2;

/**
 * Discovers live hosts on a user-supplied network/IP/subnet with an nmap ping sweep
 * (`nmap -sn`: ARP + MAC/vendor as root, falling back to TCP probes otherwise). Runs
 * in the Kali container when KALI_CONTAINER is set, else on the API host.
 */
@Injectable()
export class NetworkScanService {
  private readonly allowPrivate: boolean;
  private running = 0;

  constructor(
    config: ConfigService<Env, true>,
    private readonly guard: TargetGuardService,
    private readonly exec: ToolExecService,
  ) {
    this.allowPrivate = config.get('ALLOW_PRIVATE_TARGETS', { infer: true });
  }

  async scan({ target }: NetworkScanParams): Promise<NetworkScanOutput> {
    const { network, prefix } = parseCidr(target);

    if (prefix < MAX_NETWORK_SCAN_PREFIX) {
      throw new BadRequestException(
        `Network too large: "${target}" is a /${prefix}. Scan a /${MAX_NETWORK_SCAN_PREFIX} ` +
          `or smaller (at most ${2 ** (32 - MAX_NETWORK_SCAN_PREFIX)} addresses).`,
      );
    }
    if (!this.allowPrivate && !this.guard.isAllowed(network)) {
      throw new ForbiddenException(
        `Target "${target}" is a private or reserved network (${network}). ` +
          'Set ALLOW_PRIVATE_TARGETS=true to scan internal networks.',
      );
    }

    const range = `${network}/${prefix}`;
    const args = networkScanArgs(range);

    if (this.running >= MAX_CONCURRENT_NETWORK_SCANS) {
      throw new HttpException(
        `Already running ${MAX_CONCURRENT_NETWORK_SCANS} network scans. Wait for one to finish and try again.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.running++;
    try {
      const xml = await this.exec.run('nmap', args, {
        timeoutMs: SCAN_TIMEOUT_MS,
      });
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
    } finally {
      this.running--;
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
    if (err instanceof CommandFailedError && err.timedOut) {
      return new GatewayTimeoutException(
        `The nmap sweep did not finish within ${SCAN_TIMEOUT_MS / 1000} s.`,
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
