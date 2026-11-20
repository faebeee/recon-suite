import { z } from 'zod';
import type { Finding, FindingStatus, Grade } from './common/finding.js';
import type { DnssecStatus } from './features/dnssec.js';
import type { ToolId, ToolResult } from './common/tool.js';

/**
 * Request header that assigns a tool run to an engagement. When present, the API checks
 * the scope (active tools) and stores the run in the engagement's history.
 */
export const ENGAGEMENT_HEADER = 'x-engagement-id';

// ---------------------------------------------------------------- engagements

export const ENGAGEMENT_STATUSES = ['active', 'archived'] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

export const engagementInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  client: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional(),
});
export type EngagementInput = z.input<typeof engagementInputSchema>;

export const engagementPatchSchema = engagementInputSchema.partial().extend({
  status: z.enum(ENGAGEMENT_STATUSES).optional(),
});
export type EngagementPatch = z.input<typeof engagementPatchSchema>;

export interface FindingCounts {
  fail: number;
  warn: number;
  pass: number;
  info: number;
}

export interface Engagement {
  id: string;
  name: string;
  client?: string;
  description?: string;
  status: EngagementStatus;
  createdAt: string;
  updatedAt: string;
  counts: {
    scope: number;
    runs: number;
    notes: number;
    findings: FindingCounts;
  };
}

// ---------------------------------------------------------------- scope

export type ScopeKind = 'domain' | 'wildcard' | 'ip' | 'cidr';

export const scopeEntryInputSchema = z.object({
  /** example.com, *.example.com, 192.0.2.1, 192.0.2.0/24 or a URL (hostname is used). */
  value: z.string().trim().min(1).max(260),
  /** Explicitly out of scope; exclusions win over inclusions. */
  excluded: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});

export const scopeBulkInputSchema = z.object({
  entries: z.array(scopeEntryInputSchema).min(1).max(500),
});
export type ScopeBulkInput = z.input<typeof scopeBulkInputSchema>;

export interface ScopeEntry {
  id: string;
  kind: ScopeKind;
  value: string;
  excluded: boolean;
  note?: string;
  createdAt: string;
}

export const scopeCheckInputSchema = z.object({
  target: z.string().trim().min(1).max(2000),
});

export interface ScopeCheckResult {
  inScope: boolean;
  reason: string;
  entry?: Pick<ScopeEntry, 'kind' | 'value' | 'excluded'>;
}

// ---------------------------------------------------------------- runs (history)

export interface RunSummary {
  id: string;
  engagementId: string;
  tool: ToolId;
  target: string;
  startedAt: string;
  durationMs: number;
  status: 'ok' | 'error';
  /** HTTP status and message for failed runs. */
  error?: { status: number; message: string };
  findingCounts: FindingCounts;
  tags: string[];
}

export interface RunDetail extends RunSummary {
  /** Request body as sent. */
  input: unknown;
  /** Full envelope for successful runs. */
  result?: ToolResult<unknown>;
}

export const runListQuerySchema = z.object({
  tool: z.string().optional(),
  target: z.string().max(260).optional(),
  tag: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[\p{L}\p{N}_.:-]{1,40}$/u,
    'Tags are 1-40 letters, digits, "_", "-", ":" or "."',
  );

export const runPatchSchema = z.object({
  tags: z.array(tagSchema).max(20),
});
export type RunPatch = z.input<typeof runPatchSchema>;

export type RunDiffKind = 'added' | 'removed' | 'changed';

export interface RunDiff {
  before: RunSummary;
  after: RunSummary;
  entries: {
    path: string;
    kind: RunDiffKind;
    before?: unknown;
    after?: unknown;
  }[];
}

// ---------------------------------------------------------------- change monitoring

/** Cap of semantic change items per comparison. */
export const MAX_CHANGE_ITEMS = 200;
/** Tool + target pairs the engagement change feed compares (most recently run first). */
export const MAX_CHANGE_PAIRS = 100;

/** One meaningful change between two runs, e.g. a new subdomain or a port that closed. */
export interface ChangeItem {
  /** Group, e.g. "Subdomains", "Open ports", "Findings". */
  facet: string;
  /** What changed, e.g. "api.example.com", "443/tcp" or a finding title. */
  key: string;
  kind: RunDiffKind;
  before?: string;
  after?: string;
}

/** A run compared with the previous successful run of the same tool and target. */
export interface RunChanges {
  tool: ToolId;
  target: string;
  /** Previous successful run; null when this is the first one (nothing to compare). */
  before: RunSummary | null;
  after: RunSummary;
  /** Request body of `after`, so the UI can run it again. */
  input: unknown;
  /** The two runs were made with different options (e.g. other DNS record types). */
  inputChanged: boolean;
  items: ChangeItem[];
  /** More than MAX_CHANGE_ITEMS changes. */
  truncated: boolean;
  /** Structural differences of the raw output (what the run diff lists). */
  rawDifferences: number;
}

// ---------------------------------------------------------------- posture history

/** Tools whose headline result (grade or status) is tracked over time per target. */
export const POSTURE_TOOLS = [
  'http-headers',
  'tls-audit',
  'dnssec',
  'email-security',
] as const;
export type PostureTool = (typeof POSTURE_TOOLS)[number];

/** Posture tools whose result carries a 0-100 score and a letter grade. */
export const SCORED_TOOLS = [
  'http-headers',
  'tls-audit',
  'email-security',
] as const satisfies readonly PostureTool[];
export type ScoredTool = (typeof SCORED_TOOLS)[number];

export function isScoredTool(tool: string): tool is ScoredTool {
  return (SCORED_TOOLS as readonly string[]).includes(tool);
}

export const GRADES: readonly Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F'];
export const DNSSEC_STATUSES: readonly DnssecStatus[] = [
  'secure',
  'insecure',
  'bogus',
  'indeterminate',
];

export interface PosturePoint {
  runId: string;
  observedAt: string;
  /** Letter grade (SCORED_TOOLS) or DNSSEC status (dnssec). */
  value: Grade | DnssecStatus;
  /** 0-100 score (SCORED_TOOLS only). */
  score?: number;
}

export interface PostureSeries {
  tool: PostureTool;
  target: string;
  /** Successful runs, oldest first. */
  points: PosturePoint[];
}

// ---------------------------------------------------------------- notes

export const noteInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().max(50_000).default(''),
  target: z.string().trim().max(260).optional(),
  tags: z.array(tagSchema).max(20).default([]),
});
export type NoteInput = z.input<typeof noteInputSchema>;

export interface Note {
  id: string;
  engagementId: string;
  title: string;
  body: string;
  target?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------- findings & export

export interface EngagementFinding extends Finding {
  runId: string;
  tool: ToolId;
  target: string;
  observedAt: string;
}

export const EXPORT_FORMATS = ['md', 'json', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Report order of finding statuses (most severe first). */
export const FINDING_STATUS_ORDER: FindingStatus[] = [
  'fail',
  'warn',
  'info',
  'pass',
];

// ---------------------------------------------------------------- endpoints

/**
 * REST endpoints of the engagement workspace (relative to the API base, e.g. /api).
 * Responses:
 *   GET    list                -> Engagement[] (newest first)
 *   POST   list                -> Engagement            body: EngagementInput
 *   GET    one(id)             -> Engagement
 *   PATCH  one(id)             -> Engagement            body: EngagementPatch
 *   DELETE one(id)             -> 204 (cascades scope, runs, notes)
 *   GET    scope(id)           -> ScopeEntry[]
 *   POST   scope(id)           -> ScopeEntry[] (full list after adding) body: ScopeBulkInput; 400 lists invalid values
 *   DELETE scopeEntry(id, eid) -> 204
 *   POST   scopeCheck(id)      -> ScopeCheckResult      body: { target }
 *   GET    runs(id)?tool&target&tag&limit&offset -> RunPage (newest first)
 *   GET    run(runId)          -> RunDetail
 *   PATCH  run(runId)          -> RunSummary            body: RunPatch
 *   DELETE run(runId)          -> 204
 *   GET    runDiff(a, b)       -> RunDiff (a = before, b = after; same tool required, else 400)
 *   GET    runChanges(runId)   -> RunChanges (vs the previous successful run of the same tool + target)
 *   GET    changes(id)         -> RunChanges[] (latest successful run per tool + target, newest first, max MAX_CHANGE_PAIRS)
 *   GET    findings(id)        -> EngagementFinding[] (latest successful run per tool+target, most severe first)
 *   GET    posture(id)         -> PostureSeries[] (POSTURE_TOOLS, per tool+target, ordered by tool then target)
 *   GET    notes(id)           -> Note[] (newest first)
 *   POST   notes(id)           -> Note                  body: NoteInput
 *   PATCH  note(noteId)        -> Note                  body: Partial<NoteInput>
 *   DELETE note(noteId)        -> 204
 *   GET    exportFile(id, fmt) -> file download (Content-Disposition attachment)
 * Tool runs: send ENGAGEMENT_HEADER with POST /tools/<id>. Active tools then require the
 * target to be in scope (403 "Out of scope ..." otherwise); the run is stored and the
 * returned ToolResult carries `runId`.
 */
export const ENGAGEMENT_API = {
  list: '/engagements',
  one: (id: string) => `/engagements/${id}`,
  scope: (id: string) => `/engagements/${id}/scope`,
  scopeEntry: (id: string, entryId: string) =>
    `/engagements/${id}/scope/${entryId}`,
  scopeCheck: (id: string) => `/engagements/${id}/scope/check`,
  runs: (id: string) => `/engagements/${id}/runs`,
  run: (runId: string) => `/runs/${runId}`,
  runDiff: (before: string, after: string) => `/runs/${before}/diff/${after}`,
  runChanges: (runId: string) => `/runs/${runId}/changes`,
  changes: (id: string) => `/engagements/${id}/changes`,
  findings: (id: string) => `/engagements/${id}/findings`,
  posture: (id: string) => `/engagements/${id}/posture`,
  notes: (id: string) => `/engagements/${id}/notes`,
  note: (noteId: string) => `/notes/${noteId}`,
  exportFile: (id: string, format: ExportFormat) =>
    `/engagements/${id}/export?format=${format}`,
} as const;

export interface RunPage {
  total: number;
  items: RunSummary[];
}
