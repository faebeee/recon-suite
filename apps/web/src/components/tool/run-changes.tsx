import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, GitCompareArrows } from 'lucide-react';
import { useState } from 'react';
import type { ChangeItem, RunChanges, RunDiffKind } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { runChangesQuery } from '@/lib/engagement';
import { formatDateTime } from '@/lib/format';
import { toneText, type Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';

export const CHANGE_TONE: Record<RunDiffKind, Tone> = {
  added: 'green',
  removed: 'magenta',
  changed: 'yellow',
};
const SIGN: Record<RunDiffKind, string> = {
  added: '+',
  removed: '−',
  changed: '~',
};
const COLLAPSED = 12;

/** "+3 −1 ~2" counts of a change set. */
export function ChangeCounts({ items }: { items: ChangeItem[] }) {
  const counts = { added: 0, removed: 0, changed: 0 };
  for (const i of items) counts[i.kind]++;
  return (
    <span className="inline-flex gap-2 text-xs tabular-nums">
      {(Object.keys(counts) as RunDiffKind[])
        .filter((k) => counts[k] > 0)
        .map((k) => (
          <span key={k} className={toneText[CHANGE_TONE[k]]}>
            {SIGN[k]}
            {counts[k]}
            <span className="sr-only"> {k}</span>
          </span>
        ))}
    </span>
  );
}

/** Change items grouped by facet; long lists are collapsed. */
export function ChangeList({ changes }: { changes: RunChanges }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? changes.items : changes.items.slice(0, COLLAPSED);
  const facets = [...new Set(shown.map((i) => i.facet))];

  return (
    <div className="space-y-3 text-xs">
      {changes.inputChanged && (
        <p className={toneText.yellow}>
          The runs used different options, so some changes may come from that.
        </p>
      )}
      {facets.map((facet) => (
        <div key={facet} className="space-y-1">
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            {facet}
          </p>
          <ul className="space-y-1">
            {shown
              .filter((i) => i.facet === facet)
              .map((i) => (
                <li
                  key={`${i.kind}:${i.key}`}
                  className="flex flex-wrap items-baseline gap-x-2"
                >
                  <Tag tone={CHANGE_TONE[i.kind]}>{i.kind}</Tag>
                  <span className="font-semibold break-all">{i.key}</span>
                  {i.kind === 'changed' ? (
                    <span className="break-all text-muted-foreground">
                      {i.before || '(empty)'}{' '}
                      <ArrowRight
                        className="inline size-3 align-middle"
                        aria-label="to"
                      />{' '}
                      <span className="text-foreground">
                        {i.after || '(empty)'}
                      </span>
                    </span>
                  ) : (
                    (i.after ?? i.before) && (
                      <span className="break-all text-muted-foreground">
                        {i.after ?? i.before}
                      </span>
                    )
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
      {changes.items.length > COLLAPSED && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? 'Show less'
            : `Show all ${changes.items.length}${changes.truncated ? '+' : ''} changes`}
        </Button>
      )}
      {changes.items.length === 0 && changes.rawDifferences > 0 && (
        <p className="text-muted-foreground">
          No tracked changes, but {changes.rawDifferences} raw difference
          {changes.rawDifferences === 1 ? '' : 's'} in the output. Compare the
          runs in the engagement history for details.
        </p>
      )}
    </div>
  );
}

/**
 * Shown under a tool result that was stored in an engagement: what changed since the
 * previous run of the same tool and target.
 */
export function RunChangesPanel({ runId }: { runId: string }) {
  const changes = useQuery(runChangesQuery(runId));
  // Errors (e.g. the run was deleted) and first runs: nothing worth a panel.
  const c = changes.data;
  const before = c?.before;
  if (!c || !before) return null;
  const unchanged = c.items.length === 0 && c.rawDifferences === 0;

  return (
    <Panel
      title="Changes since last run"
      tone={c.items.length ? 'yellow' : undefined}
      actions={
        <Link
          to="/engagements/$engagementId"
          params={{ engagementId: c.after.engagementId }}
          search={{ tab: 'changes' }}
          className="inline-flex items-center gap-1 text-[11px] tracking-[0.15em] text-primary uppercase underline-offset-4 hover:underline"
        >
          <GitCompareArrows className="size-3.5" aria-hidden />
          All changes
        </Link>
      }
    >
      <div className="space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Compared with the run from{' '}
          <span className="text-foreground">
            {formatDateTime(before.startedAt)}
          </span>
          {!unchanged && <ChangeCounts items={c.items} />}
        </p>
        {unchanged ? (
          <p className={cn('text-sm', toneText.green)}>No changes.</p>
        ) : (
          <ChangeList changes={c} />
        )}
      </div>
    </Panel>
  );
}
