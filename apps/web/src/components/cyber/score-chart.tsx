import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { cn } from '@/lib/utils';
import type { ScoreLine, ScorePoint } from '@/lib/posture';

/** Fixed series order: colour token + dash pattern (secondary encoding). */
const SERIES = [
  { color: 'var(--series-1)', dash: undefined, swatch: 'bg-series-1' },
  { color: 'var(--series-2)', dash: '7 4', swatch: 'bg-series-2' },
  { color: 'var(--series-3)', dash: '2 3', swatch: 'bg-series-3' },
  { color: 'var(--series-4)', dash: '9 3 2 3', swatch: 'bg-series-4' },
] as const;

/** Lower score bound of each grade (see gradeFindings in @recon/shared). */
const GRADE_LINES = [
  { score: 100, grade: 'A+' },
  { score: 85, grade: 'A' },
  { score: 70, grade: 'B' },
  { score: 55, grade: 'C' },
  { score: 40, grade: 'D' },
  { score: 0, grade: 'F' },
] as const;

const HEIGHT = 220;
const M = { top: 10, right: 40, bottom: 24, left: 34 };
const HOUR = 3_600_000;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry?.contentRect.width ?? 0)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const fmtDay = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const fmtTime = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Target without scheme and trailing slash, for the narrow tooltip. */
const displayTarget = (t: string) =>
  t.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Latest point of a line at or before `at`. */
function valueAt(points: ScorePoint[], at: number) {
  let found: ScorePoint | undefined;
  for (const p of points) {
    if (p.at > at) break;
    found = p;
  }
  return found;
}

interface ScoreChartProps {
  lines: ScoreLine[];
  className?: string;
  /** Prefix targets with the tool name (off when all lines are one tool). */
  showTool?: boolean;
}

/**
 * Score (0-100) over time, one line per tool + target, with the grade
 * thresholds as reference lines. Hover or arrow keys move a crosshair that lists
 * every series at that run. Theme files style it via `data-slot="score-chart"`.
 */
export function ScoreChart({
  lines,
  className,
  showTool = true,
}: ScoreChartProps) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const shown = useMemo(() => lines.slice(0, SERIES.length), [lines]);

  const times = useMemo(
    () =>
      [...new Set(shown.flatMap((l) => l.points.map((p) => p.at)))].sort(
        (a, b) => a - b,
      ),
    [shown],
  );

  const t0 = times[0] ?? 0;
  const t1 = times.at(-1) ?? 0;
  const span = t1 - t0;
  // A single run (or runs at the same time) gets a little room on both sides.
  const [x0, x1] = span > 0 ? [t0, t1] : [t0 - HOUR, t0 + HOUR];
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const x = (t: number) => M.left + ((t - x0) / (x1 - x0)) * plotW;
  const y = (score: number) => M.top + (1 - score / 100) * plotH;
  const fmt = span < 2 * 24 * HOUR ? fmtTime : fmtDay;

  const ticks = useMemo(() => {
    const n = Math.max(2, Math.min(5, Math.floor(plotW / 110)));
    if (span === 0) return [t0];
    return Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));
  }, [plotW, span, t0, x0, x1]);

  const activeAt = active === null ? undefined : times[active];

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    let best = 0;
    times.forEach((t, i) => {
      if (Math.abs(x(t) - px) < Math.abs(x(times[best] ?? 0) - px)) best = i;
    });
    return best;
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (times.length)
      setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()));
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!times.length) return;
    const last = times.length - 1;
    const cur = active ?? last;
    const next =
      e.key === 'ArrowLeft'
        ? Math.max(0, cur - 1)
        : e.key === 'ArrowRight'
          ? Math.min(last, cur + 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : undefined;
    if (e.key === 'Escape') setActive(null);
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
  };

  const TIP_W = 264;
  const tipLeft =
    activeAt === undefined
      ? 0
      : x(activeAt) + 12 + TIP_W > width
        ? Math.max(0, x(activeAt) - 12 - TIP_W)
        : x(activeAt) + 12;

  return (
    <div data-slot="score-chart" className={cn('space-y-3', className)}>
      <ul
        className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs"
        aria-label="Legend"
      >
        {shown.map((l, i) => {
          const s = SERIES[i]!;
          const last = l.points.at(-1);
          return (
            <li key={l.key} className="flex min-w-0 items-center gap-2">
              <svg width="22" height="8" aria-hidden className="shrink-0">
                <line
                  x1="1"
                  x2="21"
                  y1="4"
                  y2="4"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeDasharray={s.dash}
                  strokeLinecap="round"
                />
              </svg>
              <span className="min-w-0 truncate">
                {showTool && (
                  <span className="text-muted-foreground">{l.tool} </span>
                )}
                <span className="text-foreground">{l.target}</span>
              </span>
              {last && (
                <span className="font-semibold text-foreground">
                  {last.grade}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div ref={wrapRef} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-labelledby={titleId}
            tabIndex={0}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            className="block touch-pan-y overflow-visible rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <title id={titleId}>
              {`Score history (0-100) of ${shown.length} series; use the arrow keys to step through runs.`}
            </title>

            {GRADE_LINES.map((g) => (
              <g key={g.grade}>
                <line
                  data-chart="grid"
                  x1={M.left}
                  x2={M.left + plotW}
                  y1={y(g.score)}
                  y2={y(g.score)}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                <text
                  x={M.left - 6}
                  y={y(g.score)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {g.score}
                </text>
                <text
                  x={M.left + plotW + 12}
                  y={g.score === 0 ? y(20) : y(g.score)}
                  dy="0.32em"
                  className="fill-muted-foreground text-[10px] font-semibold"
                >
                  {g.grade}
                </text>
              </g>
            ))}

            {ticks.map((t) => (
              <text
                key={t}
                x={x(t)}
                y={HEIGHT - 6}
                textAnchor={
                  ticks.length > 1 && t === ticks[0]
                    ? 'start'
                    : ticks.length > 1 && t === ticks.at(-1)
                      ? 'end'
                      : 'middle'
                }
                className="fill-muted-foreground text-[10px]"
              >
                {fmt.format(t)}
              </text>
            ))}

            {activeAt !== undefined && (
              <line
                x1={x(activeAt)}
                x2={x(activeAt)}
                y1={M.top}
                y2={M.top + plotH}
                stroke="var(--muted-foreground)"
                strokeWidth="1"
                opacity="0.6"
              />
            )}

            {shown.map((l, i) => {
              const s = SERIES[i]!;
              const d = l.points
                .map(
                  (p, j) =>
                    `${j ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.score).toFixed(1)}`,
                )
                .join(' ');
              return (
                <g key={l.key}>
                  {l.points.length > 1 && (
                    <path
                      data-chart="line"
                      d={d}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="2"
                      strokeDasharray={s.dash}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {l.points.map((p) => {
                    const hot = p.at === activeAt;
                    return (
                      <circle
                        key={p.runId}
                        cx={x(p.at)}
                        cy={y(p.score)}
                        r={hot ? 5 : 4}
                        fill={s.color}
                        stroke="var(--card)"
                        strokeWidth="2"
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}

        {activeAt !== undefined && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 w-[264px] space-y-1.5 border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg"
            style={{ left: tipLeft }}
          >
            <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              {fmtTime.format(activeAt)}
            </p>
            <ul className="space-y-1">
              {shown.map((l, i) => {
                const s = SERIES[i]!;
                const p = valueAt(l.points, activeAt);
                return (
                  <li key={l.key} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 h-0.5 w-3 shrink-0 rounded-full',
                        s.swatch,
                      )}
                    />
                    <span className="min-w-0">
                      <span className="font-semibold text-foreground">
                        {p ? `${p.grade} · ${p.score}` : '–'}
                      </span>
                      {p && p.at !== activeAt && (
                        <span className="text-muted-foreground">
                          {' '}
                          (earlier)
                        </span>
                      )}
                      <span className="block truncate text-muted-foreground">
                        {showTool && `${l.tool} `}
                        {displayTarget(l.target)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-primary">
          Data table
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              <tr>
                <th className="py-1 pr-4 font-normal">Run</th>
                {showTool && <th className="py-1 pr-4 font-normal">Tool</th>}
                <th className="py-1 pr-4 font-normal">Target</th>
                <th className="py-1 pr-4 font-normal">Grade</th>
                <th className="py-1 font-normal">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown
                .flatMap((l) => l.points.map((p) => ({ l, p })))
                .sort((a, b) => b.p.at - a.p.at)
                .map(({ l, p }) => (
                  <tr key={p.runId}>
                    <td className="py-1 pr-4 whitespace-nowrap text-muted-foreground">
                      {fmtTime.format(p.at)}
                    </td>
                    {showTool && (
                      <td className="py-1 pr-4 whitespace-nowrap">{l.tool}</td>
                    )}
                    <td className="py-1 pr-4 break-all">{l.target}</td>
                    <td className="py-1 pr-4 font-semibold">{p.grade}</td>
                    <td className="py-1">{p.score}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
