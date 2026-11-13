import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { CommandFailedError, runCommand } from './run-command.js';
import {
  buildKaliExec,
  buildKaliInspect,
  buildKaliRun,
  buildKaliStart,
  classifyKaliFailure,
  firstLine,
  KALI_GRACE_MS,
  KaliUnavailableError,
  mapKaliError,
  parseKaliInspect,
  type ExecCommand,
  type ExecTarget,
  type KaliFailure,
  type KaliState,
  type KaliTarget,
} from './tool-exec.js';

const START_TIMEOUT_MS = 30_000;
const RUN_TIMEOUT_MS = 60_000;

/**
 * Runs security tooling (nmap, ip) either on the API host or, when
 * KALI_CONTAINER is set, inside the Kali container via `docker|podman exec`.
 * Same rules as runCommand(): fixed command names, arguments as an array, no shell.
 *
 * Self-healing: when the container is stopped it is started, and when it does not exist
 * (e.g. after `compose down`) it is created from KALI_IMAGE, then the command is retried once.
 */
@Injectable()
export class ToolExecService {
  private readonly logger = new Logger('ToolExec');
  readonly target: ExecTarget;
  private readonly image?: string;
  /** Concurrent requests share one start/create attempt. */
  private starting?: Promise<void>;

  constructor(config: ConfigService<Env, true>) {
    const container = config.get('KALI_CONTAINER', { infer: true });
    this.target = container
      ? {
          kind: 'kali',
          cli: config.get('CONTAINER_CLI', { infer: true }),
          container,
        }
      : { kind: 'local' };
    this.image = config.get('KALI_IMAGE', { infer: true });
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
    /** `null`: no time limit (long nmap scans). */
    { timeoutMs = 20_000 }: { timeoutMs?: number | null } = {},
  ): Promise<string> {
    const target = this.target;
    if (target.kind === 'local') {
      return this.command(command, args, timeoutMs);
    }
    const exec = buildKaliExec(target, command, args, timeoutMs);
    const once = () =>
      this.command(
        exec.command,
        exec.args,
        timeoutMs === null ? null : timeoutMs + KALI_GRACE_MS,
      );
    try {
      return await once();
    } catch (err) {
      const failure = classifyKaliFailure(err);
      if (failure !== 'stopped' && failure !== 'missing') {
        throw mapKaliError(err, target, command);
      }
      await this.ensureRunning(target, failure);
    }
    try {
      return await once();
    } catch (err) {
      throw mapKaliError(err, target, command);
    }
  }

  /** Read-only Kali container state; undefined when tools run on the API host. */
  async kaliState(): Promise<KaliState | undefined> {
    if (this.target.kind !== 'kali') return undefined;
    const inspect = buildKaliInspect(this.target);
    try {
      return parseKaliInspect(
        await this.command(inspect.command, inspect.args, 5_000),
      );
    } catch (err) {
      return parseKaliInspect(err);
    }
  }

  /** Seam for tests; production runs the fixed command via execFile (no shell). */
  protected command(
    command: string,
    args: readonly string[],
    timeoutMs: number | null,
  ): Promise<string> {
    return runCommand(command, args, { timeoutMs: timeoutMs ?? 0 });
  }

  private ensureRunning(
    target: KaliTarget,
    failure: KaliFailure,
  ): Promise<void> {
    this.starting ??= this.startOrCreate(target, failure).finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }

  private async startOrCreate(
    target: KaliTarget,
    failure: KaliFailure,
  ): Promise<void> {
    if (failure === 'stopped') return this.start(target);
    if (!this.image) {
      throw new KaliUnavailableError(
        `Kali container "${target.container}" does not exist and KALI_IMAGE is not set, so it can't be created`,
      );
    }
    this.logger.warn(
      `Kali container "${target.container}" not found, creating it from ${this.image}`,
    );
    const run = buildKaliRun(target, this.image);
    try {
      await this.command(run.command, run.args, RUN_TIMEOUT_MS);
    } catch (err) {
      // Someone else created it in the meantime: just make sure it runs.
      if (
        err instanceof CommandFailedError &&
        /already in use|already exists/i.test(err.stderr)
      ) {
        return this.start(target);
      }
      throw new KaliUnavailableError(
        `Could not create Kali container "${target.container}" from ${this.image}: ${describe(err)}`,
      );
    }
  }

  private async start(target: KaliTarget): Promise<void> {
    this.logger.warn(
      `Kali container "${target.container}" is stopped, starting it`,
    );
    const start = buildKaliStart(target);
    try {
      await this.command(start.command, start.args, START_TIMEOUT_MS);
    } catch (err) {
      throw new KaliUnavailableError(
        `Could not start Kali container "${target.container}": ${describe(err)}`,
      );
    }
  }
}

function describe(err: unknown): string {
  if (err instanceof CommandFailedError) return firstLine(err.stderr);
  return err instanceof Error ? err.message : String(err);
}
