import { execFile } from 'node:child_process';

export class CommandNotFoundError extends Error {
  constructor(readonly command: string) {
    super(`Command "${command}" not found`);
  }
}

export class CommandFailedError extends Error {
  constructor(
    readonly command: string,
    readonly stderr: string,
    readonly timedOut: boolean,
  ) {
    super(
      timedOut
        ? `"${command}" timed out`
        : `"${command}" failed: ${stderr.trim() || 'unknown error'}`,
    );
  }
}

/**
 * Runs a fixed OS command without a shell. Never pass user input as `command`;
 * arguments are passed as an array so they are not shell-interpreted.
 */
export function runCommand(
  command: string,
  args: readonly string[],
  { timeoutMs = 20_000, maxBuffer = 10 * 1024 * 1024 } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, maxBuffer, windowsHide: true },
      (err, stdout, stderr) => {
        if (!err) return resolve(stdout);
        const e = err as NodeJS.ErrnoException & { killed?: boolean };
        if (e.code === 'ENOENT')
          return reject(new CommandNotFoundError(command));
        reject(new CommandFailedError(command, String(stderr), !!e.killed));
      },
    );
  });
}
