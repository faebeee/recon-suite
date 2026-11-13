import { statSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDrizzle } from '@nestjs/drizzle';
import { gt } from 'drizzle-orm';
import type { SystemOverview } from '@recon/shared';
import { envSchema, type Env } from '../../config/env.js';
import type { Db } from '../../core/db/database.js';
import { engagements, notes, runs, sessions } from '../../core/db/schema.js';
import { ToolExecService } from '../../core/process/tool-exec.service.js';
import { PlatformDiagnosticsService } from './platform-diagnostics.service.js';
import {
  buildChecks,
  countTools,
  describeSettings,
  overallStatus,
  SETTING_META,
} from './system-overview.js';

const STARTED_AT = new Date();

/**
 * Settings and live status of the API for the system page. Read-only: it counts database
 * rows and inspects the Kali container's state, but never starts or changes anything.
 */
@Injectable()
export class SystemOverviewService {
  private readonly env: Env;
  private readonly defaults = envSchema.parse({});

  constructor(
    config: ConfigService<Env, true>,
    private readonly diagnostics: PlatformDiagnosticsService,
    private readonly exec: ToolExecService,
    @InjectDrizzle() private readonly db: Db,
  ) {
    this.env = Object.fromEntries(
      (Object.keys(SETTING_META) as (keyof Env)[]).map((key) => [
        key,
        config.get(key, { infer: true }),
      ]),
    ) as Env;
  }

  async overview(): Promise<SystemOverview> {
    const runtime = this.diagnostics.runtime;
    const [database, kali] = await Promise.all([
      this.database(),
      this.exec.kaliState(),
    ]);
    const tools = countTools(runtime.tools.map((t) => t.status));
    const checks = buildChecks({
      env: this.env,
      kali,
      database: database.ok
        ? { ok: true }
        : { ok: false, error: database.error },
      tools,
    });
    return {
      generatedAt: new Date().toISOString(),
      api: {
        version: process.env.npm_package_version ?? '0.0.1',
        nodeVersion: process.versions.node,
        platform: platform(),
        arch: arch(),
        location: runtime.api.location,
        startedAt: STARTED_AT.toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssBytes: process.memoryUsage.rss(),
      },
      status: overallStatus(checks),
      checks,
      settings: describeSettings(this.env, this.defaults),
      database: {
        path: this.databaseFile,
        sizeBytes: this.databaseSize(),
        ...(database.ok
          ? database.counts
          : { engagements: 0, runs: 0, notes: 0, activeSessions: 0 }),
      },
      tools,
    };
  }

  private async database(): Promise<
    | {
        ok: true;
        counts: Pick<
          SystemOverview['database'],
          'engagements' | 'runs' | 'notes' | 'activeSessions'
        >;
      }
    | { ok: false; error: string }
  > {
    try {
      const [e, r, n, s] = await Promise.all([
        this.db.$count(engagements),
        this.db.$count(runs),
        this.db.$count(notes),
        this.db.$count(sessions, gt(sessions.expiresAt, Date.now())),
      ]);
      return {
        ok: true,
        counts: { engagements: e, runs: r, notes: n, activeSessions: s },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }

  private get databaseFile(): string {
    const path = this.env.DATABASE_PATH;
    return path === ':memory:' || isAbsolute(path) ? path : resolve(path);
  }

  /** Main file plus WAL; undefined in memory or when the file can't be read. */
  private databaseSize(): number | undefined {
    const file = this.databaseFile;
    if (file === ':memory:') return undefined;
    let total = 0;
    for (const f of [file, `${file}-wal`]) {
      try {
        total += statSync(f).size;
      } catch {
        if (f === file) return undefined;
      }
    }
    return total;
  }
}
