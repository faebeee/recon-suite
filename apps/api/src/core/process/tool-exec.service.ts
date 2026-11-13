import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { runCommand } from './run-command.js';
import {
  buildKaliExec,
  KALI_GRACE_MS,
  mapKaliError,
  type ExecCommand,
  type ExecTarget,
} from './tool-exec.js';

/**
 * Runs security tooling (arp-scan, nmap, ...) either on the API host or, when
 * KALI_CONTAINER is set, inside the Kali container via `docker|podman exec`.
 * Same rules as runCommand(): fixed command names, arguments as an array, no shell.
 */
@Injectable()
export class ToolExecService {
  readonly target: ExecTarget;

  constructor(config: ConfigService<Env, true>) {
    const container = config.get('KALI_CONTAINER', { infer: true });
    this.target = container
      ? {
          kind: 'kali',
          cli: config.get('CONTAINER_CLI', { infer: true }),
          container,
        }
      : { kind: 'local' };
  }

  /** Human-readable prefix for `method` fields, e.g. "docker exec recon-kali". */
  get via(): string | undefined {
    return this.target.kind === 'kali'
      ? `${this.target.cli} exec ${this.target.container}`
      : undefined;
  }

  async run(
    command: ExecCommand,
    args: readonly string[],
    { timeoutMs = 20_000 }: { timeoutMs?: number } = {},
  ): Promise<string> {
    const target = this.target;
    if (target.kind === 'local') {
      return runCommand(command, args, { timeoutMs });
    }
    const exec = buildKaliExec(target, command, args, timeoutMs);
    try {
      return await runCommand(exec.command, exec.args, {
        timeoutMs: timeoutMs + KALI_GRACE_MS,
      });
    } catch (err) {
      throw mapKaliError(err, target, command);
    }
  }
}
