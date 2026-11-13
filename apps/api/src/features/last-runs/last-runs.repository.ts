import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq } from 'drizzle-orm';
import type { LastToolRun, ToolId, ToolResult } from '@recon/shared';
import type { Db } from '../../core/db/database.js';
import { toolLastRuns } from '../../core/db/schema.js';

type Row = typeof toolLastRuns.$inferSelect;

/** Shown for runs that were still `running` when the API stopped. */
export const INTERRUPTED_MESSAGE =
  'The API restarted before this run finished. Run it again.';

/** One row per tool: the most recent run, replaced by the next one. */
@Injectable()
export class LastRunsRepository implements OnApplicationBootstrap {
  private readonly logger = new Logger('LastRuns');

  constructor(@InjectDrizzle() private readonly db: Db) {}

  /** A run that was in progress when the API stopped will never finish: mark it. */
  async onApplicationBootstrap() {
    const now = new Date().toISOString();
    const stale = await this.db
      .update(toolLastRuns)
      .set({
        status: 'error',
        finishedAt: now,
        errorStatus: 503,
        errorMessage: INTERRUPTED_MESSAGE,
      })
      .where(eq(toolLastRuns.status, 'running'))
      .returning({ tool: toolLastRuns.tool });
    if (stale.length) {
      this.logger.warn(
        `Marked ${stale.length} interrupted run(s) as failed: ${stale.map((r) => r.tool).join(', ')}`,
      );
    }
  }

  async get(tool: ToolId): Promise<LastToolRun | null> {
    const [row] = await this.db
      .select()
      .from(toolLastRuns)
      .where(eq(toolLastRuns.tool, tool));
    return row ? toRun(row) : null;
  }

  /** Replaces the tool's last run with a new, running one. */
  async start(r: {
    id: string;
    tool: ToolId;
    target: string;
    input: unknown;
    startedAt: string;
    engagementId?: string;
  }): Promise<void> {
    const values = {
      id: r.id,
      target: r.target,
      input: JSON.stringify(r.input ?? null),
      status: 'running' as const,
      startedAt: r.startedAt,
      finishedAt: null,
      durationMs: null,
      result: null,
      errorStatus: null,
      errorMessage: null,
      engagementId: r.engagementId ?? null,
    };
    await this.db
      .insert(toolLastRuns)
      .values({ tool: r.tool, ...values })
      .onConflictDoUpdate({ target: toolLastRuns.tool, set: values });
  }

  /**
   * Stores the outcome. No-op when a newer run of the same tool has started meanwhile
   * (the row then belongs to that run).
   */
  async finish(
    tool: ToolId,
    id: string,
    outcome:
      | { result: ToolResult<unknown> }
      | { error: { status: number; message: string }; durationMs: number },
  ): Promise<void> {
    const finishedAt = new Date().toISOString();
    const set =
      'result' in outcome
        ? {
            status: 'ok' as const,
            target: outcome.result.target,
            finishedAt,
            durationMs: outcome.result.durationMs,
            result: JSON.stringify(outcome.result),
          }
        : {
            status: 'error' as const,
            finishedAt,
            durationMs: outcome.durationMs,
            errorStatus: outcome.error.status,
            errorMessage: outcome.error.message,
          };
    await this.db
      .update(toolLastRuns)
      .set(set)
      .where(and(eq(toolLastRuns.tool, tool), eq(toolLastRuns.id, id)));
  }
}

function toRun(row: Row): LastToolRun {
  return {
    id: row.id,
    tool: row.tool as ToolId,
    target: row.target,
    input: JSON.parse(row.input) as unknown,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? undefined,
    durationMs: row.durationMs ?? undefined,
    result: row.result
      ? (JSON.parse(row.result) as ToolResult<unknown>)
      : undefined,
    error:
      row.status === 'error'
        ? {
            status: row.errorStatus ?? 500,
            message: row.errorMessage ?? 'Request failed',
          }
        : undefined,
    engagementId: row.engagementId ?? undefined,
  };
}
