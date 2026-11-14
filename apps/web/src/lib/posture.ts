import {
  GRADES,
  type DnssecStatus,
  type Grade,
  type PostureSeries,
} from '@recon/shared';
import { getTool } from '@/features/registry';

/** Lines a score chart shows at most (one validated series colour each). */
export const MAX_CHART_SERIES = 4;

export interface ScorePoint {
  runId: string;
  at: number;
  score: number;
  grade: Grade;
}

export interface ScoreLine {
  key: string;
  tool: string;
  target: string;
  points: ScorePoint[];
}

const isGrade = (v: string): v is Grade =>
  (GRADES as readonly string[]).includes(v);

/**
 * Score lines for the graded posture tools: the most recently run series (up to
 * `MAX_CHART_SERIES`), kept in the API's stable tool/target order so a series keeps
 * its colour while the others stay the same.
 */
export function scoreLines(series: PostureSeries[]) {
  const graded = series
    .map((s): ScoreLine & { last: number } => {
      const points = s.points.flatMap((p) =>
        p.score !== undefined && isGrade(p.value)
          ? [
              {
                runId: p.runId,
                at: Date.parse(p.observedAt),
                score: p.score,
                grade: p.value,
              },
            ]
          : [],
      );
      return {
        key: `${s.tool}:${s.target}`,
        tool: getTool(s.tool).name,
        target: s.target,
        points,
        last: points.at(-1)?.at ?? 0,
      };
    })
    .filter((l) => l.points.length > 0);
  const keep = new Set(
    [...graded]
      .sort((a, b) => b.last - a.last)
      .slice(0, MAX_CHART_SERIES)
      .map((l) => l.key),
  );
  return {
    lines: graded
      .filter((l) => keep.has(l.key))
      .map(({ last: _last, ...l }) => l),
    hidden: graded.length - keep.size,
  };
}

/** Latest DNSSEC status per target (DNSSEC has no score to plot). */
export function latestDnssec(series: PostureSeries[]) {
  return series.flatMap((s) => {
    const last = s.points.at(-1);
    return s.tool === 'dnssec' && last
      ? [
          {
            target: s.target,
            status: last.value as DnssecStatus,
            runId: last.runId,
          },
        ]
      : [];
  });
}
