import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { helperInstalled } from '../../core/native/macos-helper.js';
import { findExecutable } from '../../core/process/find-executable.js';
import {
  diagnosePlatform,
  formatDiagnosis,
  type HostFacts,
  type ToolSupport,
} from './platform-diagnostics.js';

/**
 * Checks at boot which tools this host can run and logs why the others can't
 * (missing software, permissions, platform). Only inspects PATH and the filesystem;
 * it never runs a scan or a command.
 */
@Injectable()
export class PlatformDiagnosticsService implements OnApplicationBootstrap {
  private readonly logger = new Logger('PlatformDiagnostics');
  private results: ToolSupport[] = [];

  constructor(private readonly config: ConfigService<Env, true>) {}

  onApplicationBootstrap(): void {
    this.results = diagnosePlatform(this.collectFacts());
    const lines = formatDiagnosis(this.results);
    const problems = this.results.filter((r) => r.status !== 'ok').length;
    const summary = problems
      ? `${this.results.length - problems}/${this.results.length} tools fully supported on ${process.platform}`
      : `All ${this.results.length} tools supported on ${process.platform}`;
    const report = [summary, ...lines].join('\n');
    if (problems) this.logger.warn(report);
    else this.logger.log(report);
  }

  /** Last diagnosis (empty before bootstrap). */
  get diagnosis(): readonly ToolSupport[] {
    return this.results;
  }

  private collectFacts(): HostFacts {
    const cache = new Map<string, boolean>();
    return {
      platform: process.platform,
      localToolsEnabled: this.config.get('LOCAL_TOOLS_ENABLED', {
        infer: true,
      }),
      has: (cmd) => {
        if (!cache.has(cmd)) cache.set(cmd, !!findExecutable(cmd));
        return cache.get(cmd)!;
      },
      macosHelperInstalled: process.platform === 'darwin' && helperInstalled(),
      isRoot: process.getuid?.() === 0,
      inContainer:
        existsSync('/.dockerenv') || existsSync('/run/.containerenv'),
      hasIpv4Interface: Object.values(networkInterfaces()).some((infos) =>
        infos?.some((i) => !i.internal && i.family === 'IPv4'),
      ),
      netRawAllowed: netRawInBoundingSet(),
      apiKeys: {
        nvd: !!this.config.get('NVD_API_KEY', { infer: true }),
        securityTrails: !!this.config.get('SECURITYTRAILS_API_KEY', {
          infer: true,
        }),
      },
    };
  }
}

const CAP_NET_RAW = 13n;

/** Linux only: reads CapBnd from /proc; other platforms have no capability sets. */
function netRawInBoundingSet(): boolean {
  if (process.platform !== 'linux') return true;
  try {
    const match = /^CapBnd:\s*([0-9a-f]+)$/im.exec(
      readFileSync('/proc/self/status', 'utf8'),
    );
    return !match || ((BigInt(`0x${match[1]}`) >> CAP_NET_RAW) & 1n) === 1n;
  } catch {
    return true;
  }
}
