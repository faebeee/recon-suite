import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowDownRight, ArrowUpRight, Minus, Shuffle } from 'lucide-react';
import {
  DNSSEC_STATUSES,
  GRADES,
  POSTURE_TOOLS,
  type DnssecStatus,
  type PosturePoint,
  type PostureSeries,
  type PostureTool,
} from '@recon/shared';
import { Panel, ScoreChart, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { getTool } from '@/features/registry';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  DNSSEC_TONE,
  gradeTone,
  toneBorder,
  toneSoftBg,
  toneText,
  type Tone,
} from '@/lib/tones';
import { cn } from '@/lib/utils';
import { postureQuery } from '@/lib/engagement';
import { scoreLines } from '@/lib/posture';
import { ErrorText, labelClass } from './ui';

/** Runs shown as chips per series; older ones are summarised as "+N earlier". */
const MAX_CHIPS = 12;

const isDnssec = (v: string): v is DnssecStatus =>
  (DNSSEC_STATUSES as readonly string[]).includes(v);

function valueTone(value: PosturePoint['value']): Tone {
  return isDnssec(value) ? DNSSEC_TONE[value] : gradeTone(value);
}

/** Lower is better; undefined when the value cannot be ranked (indeterminate). */
function rank(tool: PostureTool, value: PosturePoint['value']) {
  if (tool === 'dnssec') {
    const order: Partial<Record<DnssecStatus, number>> = {
      secure: 0,
      insecure: 1,
      bogus: 2,
    };
    return isDnssec(value) ? order[value] : undefined;
  }
  const i = GRADES.indexOf(value as (typeof GRADES)[number]);
  return i < 0 ? undefined : i;
}

type Trend = 'improved' | 'regressed' | 'unchanged' | 'changed';

function trendOf(tool: PostureTool, prev: PosturePoint, last: PosturePoint) {
  if (prev.value === last.value) {
    if (prev.score !== undefined && last.score !== undefined) {
      if (last.score > prev.score) return 'improved';
      if (last.score < prev.score) return 'regressed';
    }
    return 'unchanged';
  }
  const a = rank(tool, prev.value);
  const b = rank(tool, last.value);
  if (a === undefined || b === undefined) return 'changed';
  return b < a ? 'improved' : 'regressed';
}

const TREND: Record<Trend, { icon: typeof Minus; tone: Tone }> = {
  improved: { icon: ArrowUpRight, tone: 'green' },
  regressed: { icon: ArrowDownRight, tone: 'magenta' },
  unchanged: { icon: Minus, tone: 'muted' },
  changed: { icon: Shuffle, tone: 'yellow' },
};

export function PosturePanel({ engagementId }: { engagementId: string }) {
  const posture = useQuery(postureQuery(engagementId));
  const tools = POSTURE_TOOLS.map((id) => getTool(id).name).join(', ');

  return (
    <Panel title="Posture history" bodyClassName="p-0">
      {posture.isPending ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
      ) : posture.isError ? (
        <div className="px-4 py-3">
          <ErrorText error={posture.error} />
        </div>
      ) : posture.data.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          No history yet. Run {tools} while this engagement is active to track
          how grades and statuses change per target.
        </p>
      ) : (
        <>
          <PostureChart series={posture.data} />
          <ul className="divide-y divide-border">
            {posture.data.map((s) => (
              <SeriesRow key={`${s.tool}:${s.target}`} series={s} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function PostureChart({ series }: { series: PostureSeries[] }) {
  const { lines, hidden } = scoreLines(series);
  if (!lines.length) return null;
  return (
    <div className="space-y-2 border-b border-border px-4 py-3">
      <ScoreChart lines={lines} />
      {hidden > 0 && (
        <p className="text-xs text-muted-foreground">
          Chart shows the {lines.length} most recently run targets; all{' '}
          {lines.length + hidden} are listed below.
        </p>
      )}
    </div>
  );
}

function SeriesRow({ series: s }: { series: PostureSeries }) {
  const tool = getTool(s.tool);
  const last = s.points.at(-1);
  const prev = s.points.at(-2);
  if (!last) return null;
  const trend = prev ? trendOf(s.tool, prev, last) : undefined;
  const shown = s.points.slice(-MAX_CHIPS);
  const hidden = s.points.length - shown.length;
  const lastTone = valueTone(last.value);

  return (
    <li className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <Tag tone={tool.tone} accent>
            {tool.name}
          </Tag>
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="break-all text-primary">{s.target}</span>
            <PivotLinks value={s.target} />
          </span>
          <span className="text-muted-foreground">
            {s.points.length} run{s.points.length === 1 ? '' : 's'}
            {s.points.length > 1 &&
              ` · ${formatDate(s.points[0]?.observedAt)} – ${formatDate(last.observedAt)}`}
          </span>
        </div>
        <ol
          className="flex flex-wrap items-center gap-1"
          aria-label={`${tool.name} history for ${s.target}, oldest first`}
        >
          {hidden > 0 && (
            <li className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              +{hidden} earlier
            </li>
          )}
          {shown.map((p) => (
            <li key={p.runId}>
              <PointChip
                point={p}
                path={tool.path}
                latest={p === last}
                toolName={tool.name}
              />
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center gap-4 md:justify-end">
        {s.points.some((p) => p.score !== undefined) && (
          <ScoreSparkline points={s.points} tone={lastTone} />
        )}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className={labelClass}>Latest</p>
            <p
              className={cn(
                'font-dot text-2xl leading-none font-bold uppercase',
                toneText[lastTone],
              )}
            >
              {last.value}
            </p>
            {last.score !== undefined && (
              <p className="text-[10px] text-muted-foreground">
                score {last.score}
              </p>
            )}
          </div>
          {trend && <TrendBadge trend={trend} />}
        </div>
      </div>
    </li>
  );
}

function PointChip({
  point: p,
  path,
  latest,
  toolName,
}: {
  point: PosturePoint;
  path: ReturnType<typeof getTool>['path'];
  latest: boolean;
  toolName: string;
}) {
  const tone = valueTone(p.value);
  const label = `${toolName} run ${formatDateTime(p.observedAt)}: ${p.value}${
    p.score !== undefined ? `, score ${p.score}` : ''
  }`;
  return (
    <Link
      to={path}
      search={{ run: p.runId }}
      title={label}
      aria-label={label}
      data-tone={tone}
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center border px-1.5 text-[10px] leading-none font-semibold tracking-[0.1em] uppercase transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
        toneBorder[tone],
        toneText[tone],
        latest && toneSoftBg[tone],
      )}
    >
      {isDnssec(p.value) ? p.value.slice(0, 3) : p.value}
    </Link>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  const { icon: Icon, tone } = TREND[trend];
  return (
    <span
      className={cn(
        'inline-flex flex-col items-center gap-0.5 text-[10px] tracking-[0.15em] uppercase',
        toneText[tone],
      )}
      title={`${trend} since the previous run`}
    >
      <Icon className="size-4" aria-hidden />
      {trend}
    </span>
  );
}

/** Score (0-100) over runs; one point per run, evenly spaced. */
function ScoreSparkline({
  points,
  tone,
}: {
  points: PosturePoint[];
  tone: Tone;
}) {
  const scored = points.filter(
    (p): p is PosturePoint & { score: number } => p.score !== undefined,
  );
  if (scored.length < 2) return null;
  const w = 120;
  const h = 32;
  const pad = 3;
  const xy = scored.map((p, i) => [
    pad + (i / (scored.length - 1)) * (w - pad * 2),
    pad + (1 - p.score / 100) * (h - pad * 2),
  ]);
  const d = xy
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x?.toFixed(1)} ${y?.toFixed(1)}`)
    .join(' ');
  const [lx, ly] = xy.at(-1) ?? [0, 0];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      role="img"
      aria-label={`Score history: ${scored.map((p) => p.score).join(', ')}`}
      className={cn('shrink-0 overflow-visible', toneText[tone])}
    >
      <line
        x1={pad}
        x2={w - pad}
        y1={h / 2}
        y2={h / 2}
        className="stroke-border"
        strokeDasharray="2 3"
      />
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r="2.5" fill="currentColor" />
    </svg>
  );
}
