import { z } from 'zod';
import { TOOL_IDS, type ToolId, type ToolResult } from './tool.js';

/** running: the API is still executing it. ok/error: finished. */
export type LastRunStatus = 'running' | 'ok' | 'error';

/**
 * The most recent run of a tool, stored in the database (one per tool), so a tool page shows
 * it again after navigating away, reloading or switching browsers. A run still in progress is
 * stored as `running` and updated when it finishes.
 */
export interface LastToolRun<T = unknown> {
  /** Unique id of this execution. */
  id: string;
  tool: ToolId;
  /** The requested target (for local tools: the API host name once finished). */
  target: string;
  /** Request body as sent. */
  input: unknown;
  status: LastRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  /** Full envelope (status ok). */
  result?: ToolResult<T>;
  /** HTTP status and message (status error). */
  error?: { status: number; message: string };
  /** Engagement the run was made in, if any. */
  engagementId?: string;
}

/** Response of GET /api/last-runs/<tool>. */
export interface LastToolRunResponse<T = unknown> {
  run: LastToolRun<T> | null;
}

/** One tool's last run without input or result (for marking tools in navigation). */
export type LastRunSummary = Pick<
  LastToolRun,
  'tool' | 'target' | 'status' | 'startedAt' | 'finishedAt'
>;

/** Response of GET /api/last-runs: every tool that has a stored run. */
export interface LastRunsSummaryResponse {
  runs: LastRunSummary[];
}

export const LAST_RUNS_ENDPOINT = '/last-runs';

export const lastRunToolSchema = z.enum(TOOL_IDS);

export const lastRunEndpoint = (tool: ToolId) => `/last-runs/${tool}`;
