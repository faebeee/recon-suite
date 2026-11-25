import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { ToolId } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { toneBg, toneText } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { IntelViewExportButton } from './intel-view-export-button';
import { PivotLinks } from './pivot-links';
import {
  C,
  clip,
  LABEL_ALL_UP_TO,
  layout,
  R_MAX,
  R_MIN,
  SIZE,
  type Discovery,
  type RadarBlip,
  type RadarGroup,
} from './radar-layout';

export type { Discovery, RadarBlip, RadarGroup };

/**
 * Radar view of a discovery tool's results: the target in the centre, findings as blips
 * connected to it, one ring per group. Click a blip (or focus the radar and use the arrow
 * keys) to see its details and pivots. The tables below it stay the full data view.
 */
export function DiscoveryRadar({
  center,
  blips,
  groups,
  exclude,
  tool,
  title = 'Radar',
  max = 150,
  distanceHint,
}: {
  center: string;
  blips: RadarBlip[];
  groups: RadarGroup[];
  /** Tool to leave out of the pivot links (the current one). */
  exclude?: ToolId;
  /** Tool named in the Intel View export; defaults to `exclude`. */
  tool?: ToolId;
  title?: string;
  /** Blips drawn at most (the rest is counted). */
  max?: number;
  /** Explains what the distance from the centre means, e.g. "closer = stronger signal". */
  distanceHint?: string;
}) {
  const gradientId = useId();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of blips) m.set(b.group, (m.get(b.group) ?? 0) + 1);
    return m;
  }, [blips]);
  const visible = useMemo(
    () => blips.filter((b) => !hidden.has(b.group)),
    [blips, hidden],
  );
  const drawn = useMemo(() => visible.slice(0, max), [visible, max]);
  const placed = useMemo(() => layout(drawn, groups), [drawn, groups]);
  const current = placed.find((b) => b.id === selected);
  const labelAll = placed.length <= LABEL_ALL_UP_TO;

  const step = (dir: 1 | -1) => {
    if (!placed.length) return;
    const ordered = [...placed].sort((a, b) => a.angle - b.angle);
    const i = ordered.findIndex((b) => b.id === selected);
    const next =
      i < 0
        ? dir === 1
          ? ordered[0]
          : ordered.at(-1)
        : ordered[(i + dir + ordered.length) % ordered.length];
    setSelected(next?.id ?? null);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
    else if (e.key === 'Escape') setSelected(null);
    else return;
    e.preventDefault();
  };

  if (!blips.length) return null;

  return (
    <Panel
      title={title}
      actions={
        <IntelViewExportButton
          tool={tool ?? exclude}
          discovery={{ center, groups, blips: visible }}
        />
      }
    >
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,26rem)_1fr]">
        <svg
          data-slot="radar"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[26rem] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          role="img"
          aria-label={`${center}: ${blips.length} discoveries. Use the arrow keys to step through them.`}
          tabIndex={0}
          onKeyDown={onKey}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.28" />
            </linearGradient>
          </defs>

          {/* Grid: rings and cross hairs */}
          <g data-radar="grid" className="text-border" fill="none">
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <circle
                key={f}
                cx={C}
                cy={C}
                r={R_MIN + f * (R_MAX - R_MIN)}
                stroke="currentColor"
                strokeDasharray={f === 1 ? undefined : '2 4'}
              />
            ))}
            <line
              x1={C - R_MAX}
              y1={C}
              x2={C + R_MAX}
              y2={C}
              stroke="currentColor"
              strokeOpacity="0.5"
            />
            <line
              x1={C}
              y1={C - R_MAX}
              x2={C}
              y2={C + R_MAX}
              stroke="currentColor"
              strokeOpacity="0.5"
            />
          </g>

          {/* Sweep (hidden for reduced motion and in calm themes) */}
          <g
            data-radar="sweep"
            className="animate-radar-sweep text-primary"
            style={{ transformOrigin: `${C}px ${C}px` }}
            aria-hidden
          >
            <path
              d={`M ${C} ${C} L ${C + R_MAX} ${C} A ${R_MAX} ${R_MAX} 0 0 0 ${
                C + R_MAX * Math.cos(-Math.PI / 5)
              } ${C + R_MAX * Math.sin(-Math.PI / 5)} Z`}
              fill={`url(#${gradientId})`}
            />
            <line
              x1={C}
              y1={C}
              x2={C + R_MAX}
              y2={C}
              stroke="currentColor"
              strokeOpacity="0.6"
            />
          </g>

          {/* Links from the target to each blip */}
          <g data-radar="links">
            {placed.map((b) => (
              <line
                key={b.id}
                x1={C}
                y1={C}
                x2={b.x}
                y2={b.y}
                className={toneText[b.tone]}
                stroke="currentColor"
                strokeOpacity={
                  b.id === selected || b.id === hovered ? 0.7 : 0.14
                }
              />
            ))}
          </g>

          {/* Blips */}
          <g data-radar="blips">
            {placed.map((b) => {
              const active = b.id === selected || b.id === hovered;
              const showLabel = labelAll || active;
              const right = Math.cos(b.angle) >= 0;
              return (
                <g
                  key={b.id}
                  className={cn('cursor-pointer', toneText[b.tone])}
                  onClick={() => setSelected(b.id === selected ? null : b.id)}
                  onPointerEnter={() => setHovered(b.id)}
                  onPointerLeave={() => setHovered(null)}
                >
                  <title>{b.label}</title>
                  {/* Larger invisible hit area */}
                  <circle cx={b.x} cy={b.y} r={10} fill="transparent" />
                  {b.id === selected && (
                    <circle
                      cx={b.x}
                      cy={b.y}
                      r={9}
                      fill="none"
                      stroke="currentColor"
                    />
                  )}
                  <circle
                    cx={b.x}
                    cy={b.y}
                    r={active ? 5.5 : 4}
                    fill="currentColor"
                  />
                  {showLabel && (
                    <text
                      x={b.x + (right ? 9 : -9)}
                      y={b.y + 3.5}
                      textAnchor={right ? 'start' : 'end'}
                      className="fill-foreground text-[10px]"
                    >
                      {clip(b.label, 26)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Target */}
          <g data-radar="center" className="text-primary">
            <circle cx={C} cy={C} r={6} fill="currentColor" />
            <circle
              cx={C}
              cy={C}
              r={11}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.5"
            />
            <text
              x={C}
              y={C + 26}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-semibold"
            >
              {clip(center, 30)}
            </text>
          </g>
        </svg>

        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Rings
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {groups
                .filter((g) => counts.get(g.id))
                .map((g) => {
                  const on = !hidden.has(g.id);
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setHidden((prev) => {
                            const next = new Set(prev);
                            if (on) next.add(g.id);
                            else next.delete(g.id);
                            return next;
                          })
                        }
                        className={cn(
                          'flex items-center gap-1.5 border px-2 py-1 text-[11px] focus-visible:outline-2 focus-visible:outline-ring',
                          on
                            ? 'border-border text-foreground'
                            : 'border-dashed border-border text-muted-foreground line-through',
                        )}
                      >
                        <span
                          className={cn('size-2 rounded-full', toneBg[g.tone])}
                          aria-hidden
                        />
                        {g.label}
                        <span className="text-muted-foreground tabular-nums">
                          {counts.get(g.id)}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
            {distanceHint && (
              <p className="text-xs text-muted-foreground">{distanceHint}</p>
            )}
            {visible.length > drawn.length && (
              <p className="text-xs text-muted-foreground">
                Showing {drawn.length} of {visible.length}; hide rings to see
                the rest.
              </p>
            )}
          </div>

          <div
            className="space-y-1.5 border-t border-border pt-3"
            aria-live="polite"
          >
            {current ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold break-all">
                    {current.label}
                  </span>
                  <Tag tone={current.tone}>
                    {groups.find((g) => g.id === current.group)?.label ??
                      current.group}
                  </Tag>
                </div>
                {current.detail && (
                  <p className="text-xs break-words text-muted-foreground">
                    {current.detail}
                  </p>
                )}
                {current.pivot && (
                  <PivotLinks value={current.pivot} exclude={exclude} />
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Select a blip to see details and pivots. Click the rings above
                to hide or show a category.
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
