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
export type KaliTarget = Extract<ExecTarget, { kind: 'kali' }>;

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
  target: KaliTarget,
  command: ExecCommand,
  args: readonly string[],
  timeoutMs: number,
): { command: ContainerCli; args: string[] } {
  assertContainerName(target.container);
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
  'Start it with "pnpm compose:up" (or set KALI_IMAGE so the API can create it), or unset KALI_CONTAINER to run tools on the API host.';

/** Image references as Docker/Podman accept them; never starts with "-". */
export const IMAGE_REF_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,254}$/;

/** Kali container missing, stopped or the container engine unreachable. */
export class KaliUnavailableError extends Error {}

/**
 * Why `<cli> exec` could not reach the container (docker and podman wording):
 * stopped: exists but not running -> `start` it. missing: no such container -> `run` it.
 * engine: daemon/socket unreachable or not permitted -> nothing to recover.
 */
export type KaliFailure = 'stopped' | 'missing' | 'engine';

export function classifyKaliFailure(err: unknown): KaliFailure | undefined {
  if (!(err instanceof CommandFailedError)) return undefined;
  const stderr = err.stderr;
  if (/no such container|no container with name or id/i.test(stderr)) {
    return 'missing';
  }
  if (/is not running|state improper|is paused|is restarting/i.test(stderr)) {
    return 'stopped';
  }
  if (
    /cannot connect to the docker daemon|cannot connect to podman|permission denied while trying to connect|is the docker daemon running/i.test(
      stderr,
    )
  ) {
    return 'engine';
  }
  return undefined;
}

/** `<cli> start <container>`: starts an existing, stopped Kali container. */
export function buildKaliStart(target: KaliTarget): {
  command: ContainerCli;
  args: string[];
} {
  assertContainerName(target.container);
  return { command: target.cli, args: ['start', target.container] };
}

/**
 * `<cli> run -d ...`: creates the Kali container when it does not exist. Fixed flags, the same
 * as the kali service in compose.yaml (init, NET_RAW/NET_ADMIN, default network). `--pull never`: only a
 * locally built image is used, nothing is downloaded at request time.
 */
export function buildKaliRun(
  target: KaliTarget,
  image: string,
): { command: ContainerCli; args: string[] } {
  assertContainerName(target.container);
  if (!IMAGE_REF_RE.test(image)) {
    throw new Error(`Invalid image reference "${image}"`);
  }
  return {
    command: target.cli,
    args: [
      'run',
      '-d',
      '--name',
      target.container,
      '--init',
      '--cap-add',
      'NET_RAW',
      '--cap-add',
      'NET_ADMIN',
      '--restart',
      'unless-stopped',
      '--pull',
      'never',
      image,
    ],
  };
}

/**
 * Translates `<cli> exec` failures into the errors local runs produce, so services handle
 * both the same way. Exit codes: 124 = `timeout` fired, 125 = engine/exec error,
 * 126/127 = command not executable/not found inside the container.
 */
export function mapKaliError(
  err: unknown,
  target: KaliTarget,
  command: ExecCommand,
): unknown {
  if (err instanceof CommandNotFoundError) {
    return new KaliUnavailableError(
      `"${target.cli}" CLI not found on the API host, so the Kali container "${target.container}" can't be reached.`,
    );
  }
  if (!(err instanceof CommandFailedError)) return err;
  const stderr = err.stderr;
  if (classifyKaliFailure(err)) {
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

export function firstLine(text: string): string {
  return text.trim().split(/\r?\n/)[0] || 'unknown error';
}

function assertContainerName(name: string) {
  if (!CONTAINER_NAME_RE.test(name)) {
    throw new Error(`Invalid container name "${name}"`);
  }
}
