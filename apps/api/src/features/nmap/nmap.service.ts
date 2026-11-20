import {
  BadGatewayException,
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

/**
 * Active: runs nmap against the guard-resolved IP of the target, in the Kali container
 * (KALI_CONTAINER) or on the API host. The hostname never reaches nmap; it scans the IP
 * TargetGuardService resolved, like every other tool.
 * No time limit and no cap on parallel scans: a scan runs until nmap is done.
 */
@Injectable()
export class NmapService {
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

    const args = buildNmapArgs({
      address,
      family,
      topPorts,
      ports,
      serviceDetection,
    });

    try {
      const xml = await this.exec.run('nmap', args, { timeoutMs: null });
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
        `nmap failed: ${err.stderr.trim().split(/\r?\n/)[0] || 'unknown error'}`,
      );
    }
    return err;
  }
}
