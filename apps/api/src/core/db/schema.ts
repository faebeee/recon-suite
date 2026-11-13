import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Timestamps are ISO-8601 strings (UTC) unless noted. */
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const engagements = sqliteTable('engagements', {
  id: text().primaryKey(),
  name: text().notNull(),
  client: text(),
  description: text(),
  status: text({ enum: ['active', 'archived'] })
    .notNull()
    .default('active'),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
});

export const scopeEntries = sqliteTable(
  'scope_entries',
  {
    id: text().primaryKey(),
    engagementId: text('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['domain', 'wildcard', 'ip', 'cidr'] }).notNull(),
    value: text().notNull(),
    excluded: integer({ mode: 'boolean' }).notNull().default(false),
    note: text(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('scope_engagement_idx').on(t.engagementId)],
);

export const runs = sqliteTable(
  'runs',
  {
    id: text().primaryKey(),
    engagementId: text('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    tool: text().notNull(),
    target: text().notNull(),
    startedAt: text('started_at').notNull(),
    durationMs: integer('duration_ms').notNull(),
    status: text({ enum: ['ok', 'error'] }).notNull(),
    errorStatus: integer('error_status'),
    errorMessage: text('error_message'),
    /** JSON: request body. */
    input: text().notNull(),
    /** JSON: full ToolResult envelope (ok runs only). */
    result: text(),
    /** JSON: Finding[] (ok runs only). */
    findings: text().notNull().default('[]'),
    fail: integer().notNull().default(0),
    warn: integer().notNull().default(0),
    pass: integer().notNull().default(0),
    info: integer().notNull().default(0),
    /** JSON: string[] */
    tags: text().notNull().default('[]'),
  },
  (t) => [
    index('runs_engagement_started_idx').on(t.engagementId, t.startedAt),
    index('runs_tool_target_idx').on(t.engagementId, t.tool, t.target),
  ],
);

export const notes = sqliteTable(
  'notes',
  {
    id: text().primaryKey(),
    engagementId: text('engagement_id')
      .notNull()
      .references(() => engagements.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    body: text().notNull().default(''),
    target: text(),
    /** JSON: string[] */
    tags: text().notNull().default('[]'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('notes_engagement_idx').on(t.engagementId)],
);

/** Login sessions (@nestjs/authentication SessionStore). The id is the SHA-256 of the token. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text().primaryKey(),
    userId: text('user_id').notNull(),
    /** Epoch milliseconds. */
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    lastActiveAt: integer('last_active_at').notNull(),
    mfa: text({ enum: ['pending', 'verified'] }),
    /** JSON */
    metadata: text(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/**
 * The most recent run of each tool (one row per tool, replaced by the next run), so tool pages
 * can show it again later. Inserted as `running` when the request starts and updated when it
 * finishes; independent of engagements (their history lives in `runs`).
 */
export const toolLastRuns = sqliteTable('tool_last_runs', {
  tool: text().primaryKey(),
  /** Execution id: a finishing run only updates the row if it is still the latest one. */
  id: text().notNull(),
  target: text().notNull(),
  /** JSON: request body. */
  input: text().notNull(),
  status: text({ enum: ['running', 'ok', 'error'] }).notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  durationMs: integer('duration_ms'),
  /** JSON: full ToolResult envelope (ok runs only). */
  result: text(),
  errorStatus: integer('error_status'),
  errorMessage: text('error_message'),
  engagementId: text('engagement_id'),
});
