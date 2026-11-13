import {
  TOOL_INPUT_SCHEMAS,
  type ToolId,
  type ToolResult,
} from '@recon/shared';
import { detectTargetKind, TOOLS, type ToolEntry } from '@/features/registry';
import type { Tone } from '@/lib/tones';

export const MAX_BATCH_JOBS = 300;
export const BATCH_CONCURRENCY = 2;

/** Tools that take a target (local tools and free-text tools excluded). */
export const BATCH_TOOLS: ToolEntry[] = TOOLS.filter((t) => t.accepts.length);

export type JobStatus =
  'queued' | 'running' | 'ok' | 'error' | 'invalid' | 'cancelled';

export const JOB_TONE: Record<JobStatus, Tone> = {
  queued: 'muted',
  running: 'cyan',
  ok: 'green',
  error: 'magenta',
  invalid: 'yellow',
  cancelled: 'muted',
};

export interface Job {
  key: string;
  target: string;
  tool: ToolId;
  input: { target: string };
  status: JobStatus;
  /** Transient info, e.g. "rate limited, waiting". */
  note?: string;
  error?: string;
  result?: ToolResult<unknown>;
}

/** One target per line; blank lines and "#" comments are ignored, duplicates removed. */
export function parseTargets(text: string): string[] {
  return [
    ...new Set(
      text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#')),
    ),
  ];
}

/** targets x tools, keeping only tools that accept the target's kind. */
export function planJobs(targets: string[], tools: ToolId[]): Job[] {
  const jobs: Job[] = [];
  for (const target of targets) {
    const kind = detectTargetKind(target);
    for (const tool of BATCH_TOOLS) {
      if (!tools.includes(tool.id) || !tool.accepts.includes(kind)) continue;
      const input = { target };
      const parsed = TOOL_INPUT_SCHEMAS[tool.id].safeParse(input);
      jobs.push({
        key: `${tool.id}|${target}`,
        target,
        tool: tool.id,
        input,
        status: parsed.success ? 'queued' : 'invalid',
        error: parsed.success
          ? undefined
          : (parsed.error.issues[0]?.message ?? 'Invalid input'),
      });
    }
  }
  return jobs;
}

export function countFindings(result: ToolResult<unknown> | undefined) {
  const findings = result?.findings ?? [];
  return {
    fail: findings.filter((f) => f.status === 'fail').length,
    warn: findings.filter((f) => f.status === 'warn').length,
  };
}
