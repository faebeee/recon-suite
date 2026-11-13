import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isIP } from 'node:net';
import type { NmapOutput, NmapParams } from '@recon/shared';
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
import { buildNmapArgs, nmapFindings, parseNmapXml } from './nmap.parser.js';

/** nmap is heavy; more parallel scans than this are refused with 429. */
export const MAX_CONCURRENT_NMAP = 2;

/**
 * Active: runs nmap against the guard-resolved IP of the target, in the Kali container
 * (KALI_CONTAINER) or on the API host. The hostname never reaches nmap, so DNS rebinding
 * and blocked ranges are handled by TargetGuardService like for every other tool.
 */
@Injectable()
export class NmapService {
  private running = 0;

  constructor(
    private readonly guard: TargetGuardService,
    private readonly exec: ToolExecService,
  ) {}

  async scan({
    target,
    topPorts,
    ports,
    serviceDetection,
  }: NmapParams): Promise<NmapOutput> {
    const { addresses } = await this.guard.resolve(target);
    const address = addresses[0]!;
    const family = isIP(address) === 6 ? 6 : 4;

    const heavy =
      serviceDetection || topPorts > 100 || (ports?.length ?? 0) > 100;
    const hostTimeoutSeconds = heavy ? 150 : 60;
    const args = buildNmapArgs({
      address,
      family,
      topPorts,
      ports,
      serviceDetection,
      hostTimeoutSeconds,
    });

    if (this.running >= MAX_CONCURRENT_NMAP) {
      throw new HttpException(
        `Already running ${MAX_CONCURRENT_NMAP} nmap scans. Wait for one to finish and try again.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.running++;
    try {
      const xml = await this.exec.run('nmap', args, {
        timeoutMs: (hostTimeoutSeconds + 15) * 1000,
      });
      const parsed = parseNmapXml(xml);
      const command = `nmap ${args.join(' ')}`;
      return {
        address,
        ...parsed,
        method: this.exec.via ? `${this.exec.via} ${command}` : command,
        runner: this.exec.target.kind,
        findings: nmapFindings(parsed.ports),
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
          ? 'nmap is not installed in the Kali container. Rebuild it (pnpm compose:up:kali).'
          : 'nmap is not installed on the API host. Install it (e.g. "brew install nmap" / ' +
              '"sudo apt install nmap") or run it in a Kali container (KALI_CONTAINER).',
      );
    }
    if (err instanceof CommandFailedError) {
      return err.timedOut
        ? new GatewayTimeoutException('nmap did not finish in time.')
        : new BadGatewayException(
            `nmap failed: ${err.stderr.trim().split(/\r?\n/)[0] || 'unknown error'}`,
          );
    }
    return err;
  }
}
