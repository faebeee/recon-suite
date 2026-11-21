import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  GobusterOutput,
  GobusterParams,
  GobusterWordlistsOutput,
} from '@recon/shared';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
import { findExecutable } from '../../core/process/find-executable.js';
import {
  CommandFailedError,
  CommandNotFoundError,
} from '../../core/process/run-command.js';
import { ToolExecService } from '../../core/process/tool-exec.service.js';
import {
  buildGobusterArgs,
  connectTarget,
  gobusterFindings,
  parseGobusterOutput,
  wildcardHint,
} from './gobuster.parser.js';
import {
  NODE_WORDLIST_FS,
  availableWordlists,
  resolveWordlist,
  type WordlistFs,
} from './gobuster.wordlists.js';

/**
 * Active: runs `gobuster dir` on the API host. gobuster connects to the guard-resolved IP
 * (the hostname only travels in the Host header), uses a wordlist from the allowlist, and is
 * killed at the time limit; whatever it printed until then is returned.
 */
@Injectable()
export class GobusterService {
  private fs: WordlistFs = NODE_WORDLIST_FS;
  private installed: () => boolean = () => !!findExecutable('gobuster');

  constructor(
    private readonly guard: TargetGuardService,
    private readonly exec: ToolExecService,
  ) {}

  /** Tests only: fake file system and gobuster presence. */
  useHost(fs: WordlistFs, installed = true): this {
    this.fs = fs;
    this.installed = () => installed;
    return this;
  }

  listWordlists(): GobusterWordlistsOutput {
    return {
      installed: this.installed(),
      wordlists: availableWordlists(this.fs).map(
        ({ id, label, path, lines, builtIn }) => ({
          id,
          label,
          ...(path && { path }),
          lines,
          builtIn,
        }),
      ),
    };
  }

  async scan(p: GobusterParams): Promise<GobusterOutput> {
    const wordlist = resolveWordlist(p.wordlist, this.fs);
    if (!wordlist) {
      throw new BadRequestException(
        `Wordlist "${p.wordlist}" is not available on the API host. Pick one from the list.`,
      );
    }
    const host = new URL(p.target).hostname.replace(/^\[|\]$/g, '');
    const { addresses } = await this.guard.resolve(host);
    const address = addresses[0]!;
    const conn = connectTarget(p.target, address);

    // Built-in lists are written to a private temp file for the duration of the scan.
    const dir = wordlist.words
      ? await mkdtemp(join(tmpdir(), 'recon-gobuster-'))
      : undefined;
    const wordlistPath = dir ? join(dir, `${wordlist.id}.txt`) : wordlist.path!;
    try {
      if (dir) await writeFile(wordlistPath, `${wordlist.words!.join('\n')}\n`);
      const args = buildGobusterArgs({
        url: conn.url,
        host: conn.host,
        insecure: conn.insecure,
        wordlistPath,
        extensions: p.extensions,
        threads: p.threads,
        excludeLengths: p.excludeLengths,
      });
      let stdout: string;
      let stopped: GobusterOutput['stopped'];
      try {
        stdout = await this.exec.run('gobuster', args, {
          timeoutMs: p.timeLimitMinutes * 60_000,
        });
      } catch (err) {
        if (err instanceof CommandFailedError && err.timedOut) {
          stdout = err.stdout;
          stopped = 'time-limit';
        } else {
          throw this.toHttpError(err);
        }
      }
      const hits = parseGobusterOutput(stdout, conn.base, conn.url);
      return {
        base: conn.base,
        address,
        wordlist: {
          id: wordlist.id,
          label: wordlist.label,
          lines: wordlist.lines,
        },
        extensions: p.extensions,
        threads: p.threads,
        timeLimitMinutes: p.timeLimitMinutes,
        ...(stopped && { stopped }),
        command: `gobuster ${args.map(quote).join(' ')}`,
        hits,
        findings: gobusterFindings(hits),
      };
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true });
    }
  }

  private toHttpError(err: unknown): unknown {
    if (err instanceof CommandNotFoundError) {
      return new ServiceUnavailableException(
        'gobuster is not installed on the API host. Install it (e.g. "sudo apt install gobuster" / ' +
          '"brew install gobuster"), or use Dir Buster, which needs no extra software.',
      );
    }
    if (err instanceof CommandFailedError) {
      const hint = wildcardHint(err.stderr);
      if (hint) return new BadGatewayException(hint);
      const first =
        err.stderr
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find(Boolean) ?? 'unknown error';
      return new BadGatewayException(`gobuster failed: ${first}`);
    }
    return err;
  }
}

/** Display only (the command runs without a shell). */
function quote(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}
