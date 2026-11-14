import {
  DNSSEC_STATUSES,
  GRADES,
  POSTURE_TOOLS,
  type PosturePoint,
  type PostureSeries,
  type PostureTool,
} from '@recon/shared';

/** Successful run with the headline values pulled out of the stored result JSON. */
export interface PostureRow {
  id: string;
  tool: string;
  target: string;
  startedAt: string;
  value: unknown;
  score: unknown;
}

/** JSON paths (SQLite json_extract) of the tracked value and score per tool. */
export const POSTURE_PATHS: Record<
  PostureTool,
  { value: string; score?: string }
> = {
  'http-headers': {
    value: '$.data.security.grade',
    score: '$.data.security.score',
  },
  'tls-audit': {
    value: '$.data.report.grade',
    score: '$.data.report.score',
  },
  dnssec: { value: '$.data.status' },
  'email-security': {
    value: '$.data.report.grade',
    score: '$.data.report.score',
  },
};

const isPostureTool = (t: string): t is PostureTool =>
  (POSTURE_TOOLS as readonly string[]).includes(t);

function toPoint(tool: PostureTool, r: PostureRow): PosturePoint | undefined {
  const allowed: readonly string[] =
    tool === 'dnssec' ? DNSSEC_STATUSES : GRADES;
  if (typeof r.value !== 'string' || !allowed.includes(r.value))
    return undefined;
  return {
    runId: r.id,
    observedAt: r.startedAt,
    value: r.value as PosturePoint['value'],
    ...(typeof r.score === 'number' &&
      Number.isFinite(r.score) && { score: r.score }),
  };
}

/**
 * Groups runs into one series per tool + target (points oldest first). Rows with
 * a missing or unknown value (older result shapes, corrupt JSON) are skipped.
 */
export function buildPosture(rows: PostureRow[]): PostureSeries[] {
  const byKey = new Map<string, PostureSeries>();
  const sorted = [...rows].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
  for (const r of sorted) {
    if (!isPostureTool(r.tool)) continue;
    const point = toPoint(r.tool, r);
    if (!point) continue;
    const key = `${r.tool}\u0000${r.target}`;
    let series = byKey.get(key);
    if (!series) {
      series = { tool: r.tool, target: r.target, points: [] };
      byKey.set(key, series);
    }
    series.points.push(point);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      POSTURE_TOOLS.indexOf(a.tool) - POSTURE_TOOLS.indexOf(b.tool) ||
      a.target.localeCompare(b.target),
  );
}
