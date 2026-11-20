import { Injectable } from '@nestjs/common';
import { runCommand } from './run-command.js';
import { EXEC_COMMANDS, type ExecCommand } from './tool-exec.js';

/**
 * Runs security tooling (nmap) on the API host. In compose the API image is built on
 * Kali, so the tools are part of it. Same rules as runCommand(): fixed command names,
 * arguments as an array, no shell.
 */
@Injectable()
export class ToolExecService {
  run(
    command: ExecCommand,
    args: readonly string[],
    /** `null`: no time limit (long nmap scans). */
    { timeoutMs = 20_000 }: { timeoutMs?: number | null } = {},
  ): Promise<string> {
    if (!EXEC_COMMANDS.includes(command)) {
      throw new Error(`Command "${String(command)}" is not allowed`);
    }
    return this.command(command, args, timeoutMs);
  }

  /** Seam for tests; production runs the fixed command via execFile (no shell). */
  protected command(
    command: string,
    args: readonly string[],
    timeoutMs: number | null,
  ): Promise<string> {
    return runCommand(command, args, { timeoutMs: timeoutMs ?? 0 });
  }
}
