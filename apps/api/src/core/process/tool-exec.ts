import { CommandFailedError, CommandNotFoundError } from './run-command.js';

/**
 * Commands that may run in the Kali container (or locally as a fallback). This is a closed
 * list: the executor never accepts any other program name.
 */
export const EXEC_COMMANDS = ['arp-scan', 'nmap', 'ip'] as const;
export type ExecCommand = (typeof EXEC_COMMANDS)[number];

export type ContainerCli = 'docker' | 'podman';

/** Where tool commands run: on the API host, or via `<cli> exec` in the Kali container. */
export type ExecTarget =
  { kind: 'local' } | { kind: 'kali'; cli: ContainerCli; container: string };

/** Container names as Docker/Podman accept them. Validated again here (defense in depth). */
export const CONTAINER_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

/** Extra time the CLI gets on top of the in-container `timeout`, so that one fires first. */
export const KALI_GRACE_MS = 10_000;

/**
 * Builds `<cli> exec <container> timeout -k 5 <s> <command> <args...>`. The in-container
 * `timeout` matters: killing the local CLI process would leave the command running inside
 * the container.
 */
export function buildKaliExec(
  target: Extract<ExecTarget, { kind: 'kali' }>,
  command: ExecCommand,
  args: readonly string[],
  timeoutMs: number,
): { command: ContainerCli; args: string[] } {
  if (!CONTAINER_NAME_RE.test(target.container)) {
    throw new Error(`Invalid container name "${target.container}"`);
  }
  const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  return {
    command: target.cli,
    args: [
      'exec',
      target.container,
      'timeout',
      '-k',
      '5',
      String(seconds),
      command,
      ...args,
    ],
  };
}

/** Appended to user-facing errors when the Kali container can't be used. */
export const KALI_HINT =
  'Start it with "pnpm compose:up:kali", or unset KALI_CONTAINER to run tools on the API host.';

/** Kali container missing, stopped or the container engine unreachable. */
export class KaliUnavailableError extends Error {}

/**
 * Translates `<cli> exec` failures into the errors local runs produce, so services handle
 * both the same way. Exit codes: 124 = `timeout` fired, 125 = engine/exec error,
 * 126/127 = command not executable/not found inside the container.
 */
export function mapKaliError(
  err: unknown,
  target: Extract<ExecTarget, { kind: 'kali' }>,
  command: ExecCommand,
): unknown {
  if (err instanceof CommandNotFoundError) {
    return new KaliUnavailableError(
      `"${target.cli}" CLI not found on the API host, so the Kali container "${target.container}" can't be reached.`,
    );
  }
  if (!(err instanceof CommandFailedError)) return err;
  const stderr = err.stderr;
  if (
    /no such container|is not running|cannot connect to the docker daemon|cannot connect to podman|permission denied while trying to connect/i.test(
      stderr,
    )
  ) {
    return new KaliUnavailableError(
      `Kali container "${target.container}" is not reachable: ${firstLine(stderr)}`,
    );
  }
  if (
    err.exitCode === 126 ||
    err.exitCode === 127 ||
    /executable file not found/i.test(stderr)
  ) {
    return new CommandNotFoundError(command);
  }
  if (err.exitCode === 124 || err.timedOut) {
    return new CommandFailedError(command, stderr, true, err.exitCode);
  }
  return new CommandFailedError(command, stderr, false, err.exitCode);
}

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/)[0] ?? 'unknown error';
}
