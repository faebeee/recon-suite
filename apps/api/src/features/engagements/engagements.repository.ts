import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import type {
  Engagement,
  EngagementFinding,
  Finding,
  FindingCounts,
  Note,
  RunDetail,
  RunSummary,
  ScopeEntry,
  ToolId,
  ToolResult,
} from '@recon/shared';
import type { Db } from '../../core/db/database.js';
import {
  engagements,
  notes,
  runs,
  scopeEntries,
} from '../../core/db/schema.js';
import type { ScopeRule } from './scope.js';

type EngagementRow = typeof engagements.$inferSelect;
type RunRow = typeof runs.$inferSelect;
type NoteRow = typeof notes.$inferSelect;
type ScopeRow = typeof scopeEntries.$inferSelect;

export interface NewRun {
  engagementId: string;
  tool: ToolId;
  target: string;
  startedAt: string;
  durationMs: number;
  input: unknown;
  result?: ToolResult<unknown>;
  error?: { status: number; message: string };
}

const nowIso = () => new Date().toISOString();
const parseJson = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

/** All SQL for engagements, scope, runs and notes. */
@Injectable()
export class EngagementsRepository {
  constructor(@InjectDrizzle() private readonly db: Db) {}

  // ------------------------------------------------------------ engagements

  async listEngagements(): Promise<Engagement[]> {
    const rows = await this.db
      .select()
      .from(engagements)
      .orderBy(desc(engagements.createdAt));
    return Promise.all(rows.map((r) => this.withCounts(r)));
  }

  async getEngagement(id: string): Promise<Engagement> {
    return this.withCounts(await this.engagementRow(id));
  }

  async engagementRow(id: string): Promise<EngagementRow> {
    const [row] = await this.db
      .select()
      .from(engagements)
      .where(eq(engagements.id, id));
    if (!row) throw new NotFoundException('Engagement not found');
    return row;
  }

  async createEngagement(v: {
    name: string;
    client?: string;
    description?: string;
  }) {
    const id = randomUUID();
    await this.db.insert(engagements).values({ id, ...v });
    return this.getEngagement(id);
  }

  async updateEngagement(
    id: string,
    v: Partial<{
      name: string;
      client: string;
      description: string;
      status: 'active' | 'archived';
    }>,
  ) {
    await this.engagementRow(id);
    await this.db
      .update(engagements)
      .set({ ...v, updatedAt: nowIso() })
      .where(eq(engagements.id, id));
    return this.getEngagement(id);
  }

  async deleteEngagement(id: string) {
    await this.engagementRow(id);
    await this.db.delete(engagements).where(eq(engagements.id, id));
  }

  private async withCounts(r: EngagementRow): Promise<Engagement> {
    const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
    const [scope, runCount, noteCount, findings] = await Promise.all([
      one(
        this.db
          .select({ n: count() })
          .from(scopeEntries)
          .where(eq(scopeEntries.engagementId, r.id)),
      ),
      one(
        this.db
          .select({ n: count() })
          .from(runs)
          .where(eq(runs.engagementId, r.id)),
      ),
      one(
        this.db
          .select({ n: count() })
          .from(notes)
          .where(eq(notes.engagementId, r.id)),
      ),
      this.findings(r.id),
    ]);
    return {
      id: r.id,
      name: r.name,
      ...(r.client && { client: r.client }),
      ...(r.description && { description: r.description }),
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      counts: {
        scope,
        runs: runCount,
        notes: noteCount,
        findings: countFindings(findings),
      },
    };
  }

  // ------------------------------------------------------------ scope

  async listScope(engagementId: string): Promise<ScopeEntry[]> {
    const rows = await this.db
      .select()
      .from(scopeEntries)
      .where(eq(scopeEntries.engagementId, engagementId))
      .orderBy(scopeEntries.excluded, scopeEntries.value);
    return rows.map(toScopeEntry);
  }

  async scopeRules(engagementId: string): Promise<ScopeRule[]> {
    return (await this.listScope(engagementId)).map(
      ({ kind, value, excluded }) => ({ kind, value, excluded }),
    );
  }

  /** Inserts entries, skipping exact duplicates (same value and inclusion/exclusion). */
  async addScope(
    engagementId: string,
    entries: {
      kind: ScopeRow['kind'];
      value: string;
      excluded: boolean;
      note?: string;
    }[],
  ) {
    const existing = new Set(
      (await this.listScope(engagementId)).map(
        (e) => `${e.excluded}:${e.value}`,
      ),
    );
    const fresh = entries.filter((e) => {
      const key = `${e.excluded}:${e.value}`;
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    if (fresh.length) {
      await this.db
        .insert(scopeEntries)
        .values(fresh.map((e) => ({ id: randomUUID(), engagementId, ...e })));
    }
    await this.touch(engagementId);
  }

  async deleteScope(engagementId: string, entryId: string) {
    const deleted = await this.db
      .delete(scopeEntries)
      .where(
        and(
          eq(scopeEntries.id, entryId),
          eq(scopeEntries.engagementId, engagementId),
        ),
      )
      .returning({ id: scopeEntries.id });
    if (!deleted.length) throw new NotFoundException('Scope entry not found');
  }

  // ------------------------------------------------------------ runs

  async insertRun(r: NewRun): Promise<string> {
    const id = randomUUID();
    const findings = r.result?.findings ?? [];
    const c = countFindings(findings);
    await this.db.insert(runs).values({
      id,
      engagementId: r.engagementId,
      tool: r.tool,
      target: r.target,
      startedAt: r.startedAt,
      durationMs: r.durationMs,
      status: r.error ? 'error' : 'ok',
      errorStatus: r.error?.status ?? null,
      errorMessage: r.error?.message ?? null,
      input: JSON.stringify(r.input ?? null),
      result: r.result ? JSON.stringify({ ...r.result, runId: id }) : null,
      findings: JSON.stringify(findings),
      ...c,
    });
    await this.touch(r.engagementId);
    return id;
  }

  async listRuns(
    engagementId: string,
    q: {
      tool?: string;
      target?: string;
      tag?: string;
      limit: number;
      offset: number;
    },
  ): Promise<{ total: number; items: RunSummary[] }> {
    const where: SQL[] = [eq(runs.engagementId, engagementId)];
    if (q.tool) where.push(eq(runs.tool, q.tool));
    if (q.target)
      where.push(
        sql`instr(lower(${runs.target}), ${q.target.toLowerCase()}) > 0`,
      );
    if (q.tag)
      where.push(
        sql`exists (select 1 from json_each(${runs.tags}) where value = ${q.tag})`,
      );
    const cond = and(...where);
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: runs.id,
          engagementId: runs.engagementId,
          tool: runs.tool,
          target: runs.target,
          startedAt: runs.startedAt,
          durationMs: runs.durationMs,
          status: runs.status,
          errorStatus: runs.errorStatus,
          errorMessage: runs.errorMessage,
          fail: runs.fail,
          warn: runs.warn,
          pass: runs.pass,
          info: runs.info,
          tags: runs.tags,
        })
        .from(runs)
        .where(cond)
        .orderBy(desc(runs.startedAt))
        .limit(q.limit)
        .offset(q.offset),
      this.db.select({ n: count() }).from(runs).where(cond),
    ]);
    return { total: totals[0]?.n ?? 0, items: rows.map(toRunSummary) };
  }

  async getRun(runId: string): Promise<RunDetail> {
    const [row] = await this.db.select().from(runs).where(eq(runs.id, runId));
    if (!row) throw new NotFoundException('Run not found');
    return {
      ...toRunSummary(row),
      input: parseJson(row.input, null),
      ...(row.result && {
        result: parseJson<ToolResult<unknown>>(row.result, undefined as never),
      }),
    };
  }

  async setRunTags(runId: string, tags: string[]): Promise<RunSummary> {
    const updated = await this.db
      .update(runs)
      .set({ tags: JSON.stringify([...new Set(tags)]) })
      .where(eq(runs.id, runId))
      .returning();
    if (!updated[0]) throw new NotFoundException('Run not found');
    return toRunSummary(updated[0]);
  }

  async deleteRun(runId: string) {
    const deleted = await this.db
      .delete(runs)
      .where(eq(runs.id, runId))
      .returning({ id: runs.id });
    if (!deleted.length) throw new NotFoundException('Run not found');
  }

  /** Findings of the latest successful run per tool + target. */
  async findings(engagementId: string): Promise<EngagementFinding[]> {
    const rows = await this.db
      .select({
        id: runs.id,
        tool: runs.tool,
        target: runs.target,
        startedAt: runs.startedAt,
        findings: runs.findings,
      })
      .from(runs)
      .where(and(eq(runs.engagementId, engagementId), eq(runs.status, 'ok')))
      .orderBy(desc(runs.startedAt));
    const seen = new Set<string>();
    const out: EngagementFinding[] = [];
    for (const r of rows) {
      const key = `${r.tool}\u0000${r.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const f of parseJson<Finding[]>(r.findings, [])) {
        out.push({
          ...f,
          runId: r.id,
          tool: r.tool as ToolId,
          target: r.target,
          observedAt: r.startedAt,
        });
      }
    }
    return out;
  }

  // ------------------------------------------------------------ notes

  async listNotes(engagementId: string): Promise<Note[]> {
    const rows = await this.db
      .select()
      .from(notes)
      .where(eq(notes.engagementId, engagementId))
      .orderBy(desc(notes.createdAt));
    return rows.map(toNote);
  }

  async createNote(
    engagementId: string,
    v: { title: string; body: string; target?: string; tags: string[] },
  ) {
    const id = randomUUID();
    await this.db
      .insert(notes)
      .values({ id, engagementId, ...v, tags: JSON.stringify(v.tags) });
    await this.touch(engagementId);
    return this.getNote(id);
  }

  async getNote(noteId: string): Promise<Note> {
    const [row] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId));
    if (!row) throw new NotFoundException('Note not found');
    return toNote(row);
  }

  async updateNote(
    noteId: string,
    v: Partial<{ title: string; body: string; target: string; tags: string[] }>,
  ): Promise<Note> {
    const note = await this.getNote(noteId);
    const { tags, ...rest } = v;
    await this.db
      .update(notes)
      .set({
        ...rest,
        ...(tags && { tags: JSON.stringify(tags) }),
        updatedAt: nowIso(),
      })
      .where(eq(notes.id, noteId));
    await this.touch(note.engagementId);
    return this.getNote(noteId);
  }

  async deleteNote(noteId: string) {
    const deleted = await this.db
      .delete(notes)
      .where(eq(notes.id, noteId))
      .returning({ id: notes.id });
    if (!deleted.length) throw new NotFoundException('Note not found');
  }

  private async touch(engagementId: string) {
    await this.db
      .update(engagements)
      .set({ updatedAt: nowIso() })
      .where(eq(engagements.id, engagementId));
  }
}

export function countFindings(
  findings: Pick<Finding, 'status'>[],
): FindingCounts {
  const c: FindingCounts = { fail: 0, warn: 0, pass: 0, info: 0 };
  for (const f of findings) c[f.status]++;
  return c;
}

function toScopeEntry(r: ScopeRow): ScopeEntry {
  return {
    id: r.id,
    kind: r.kind,
    value: r.value,
    excluded: r.excluded,
    ...(r.note && { note: r.note }),
    createdAt: r.createdAt,
  };
}

function toRunSummary(
  r: Pick<
    RunRow,
    | 'id'
    | 'engagementId'
    | 'tool'
    | 'target'
    | 'startedAt'
    | 'durationMs'
    | 'status'
    | 'errorStatus'
    | 'errorMessage'
    | 'fail'
    | 'warn'
    | 'pass'
    | 'info'
    | 'tags'
  >,
): RunSummary {
  return {
    id: r.id,
    engagementId: r.engagementId,
    tool: r.tool as ToolId,
    target: r.target,
    startedAt: r.startedAt,
    durationMs: r.durationMs,
    status: r.status,
    ...(r.status === 'error' && {
      error: {
        status: r.errorStatus ?? 500,
        message: r.errorMessage ?? 'Unknown error',
      },
    }),
    findingCounts: { fail: r.fail, warn: r.warn, pass: r.pass, info: r.info },
    tags: parseJson<string[]>(r.tags, []),
  };
}

function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    engagementId: r.engagementId,
    title: r.title,
    body: r.body,
    ...(r.target && { target: r.target }),
    tags: parseJson<string[]>(r.tags, []),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
