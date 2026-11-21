import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitCompareArrows,
  Loader2,
  RotateCw,
  Square,
} from 'lucide-react';
import { useRef, useState } from 'react';
import {
  ENGAGEMENT_HEADER,
  toolEndpoint,
  type RunChanges,
} from '@recon/shared';
import { Panel, Segmented, Tag } from '@/components/cyber';
import { ChangeCounts, ChangeList } from '@/components/tool';
import { Button } from '@/components/ui/button';
import { getTool } from '@/features/registry';
import { apiPost } from '@/lib/api-client';
import { ENGAGEMENTS_KEY } from '@/lib/engagement';
import { formatDateTime } from '@/lib/format';
import { RunDiffPanel } from './run-diff';
import { changesQuery } from './queries';
import { ErrorText } from './ui';

type Filter = 'changed' | 'all';
type RerunState = { status: 'running' } | { status: 'error'; error: unknown };

const pairKey = (c: RunChanges) => `${c.tool}\u0000${c.target}`;
/** Raw differences alone (timestamps, lifetimes counting down) are noise, not changes. */
const hasChanges = (c: RunChanges) => c.items.length > 0;

/**
 * Change monitoring: the latest run of every tool + target compared with the run before,
 * plus re-running them (with the same options) to look for new changes.
 */
export function ChangesTab({
  engagementId,
  archived,
}: {
  engagementId: string;
  archived: boolean;
}) {
  const queryClient = useQueryClient();
  const changes = useQuery(changesQuery(engagementId));
  const [filter, setFilter] = useState<Filter>('changed');
  const [reruns, setReruns] = useState<Record<string, RerunState>>({});
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(
    null,
  );
  const stopRef = useRef(false);
  const [compare, setCompare] = useState<[string, string] | null>(null);

  const rerun = async (c: RunChanges) => {
    const key = pairKey(c);
    setReruns((r) => ({ ...r, [key]: { status: 'running' } }));
    try {
      // Explicit header: record into this engagement even if another one is active.
      await apiPost(toolEndpoint(c.tool), c.input ?? {}, {
        headers: { [ENGAGEMENT_HEADER]: engagementId },
      });
      setReruns(({ [key]: _done, ...rest }) => rest);
    } catch (error) {
      setReruns((r) => ({ ...r, [key]: { status: 'error', error } }));
    }
    await queryClient.invalidateQueries({
      queryKey: [...ENGAGEMENTS_KEY, engagementId],
    });
  };

  const rerunAll = async (list: RunChanges[]) => {
    stopRef.current = false;
    setBatch({ done: 0, total: list.length });
    // One at a time: these may be nmap scans against the same hosts.
    for (const [i, c] of list.entries()) {
      if (stopRef.current) break;
      await rerun(c);
      setBatch({ done: i + 1, total: list.length });
    }
    setBatch(null);
  };

  if (changes.isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (changes.isError) return <ErrorText error={changes.error} />;

  const all = changes.data;
  const changed = all.filter(hasChanges);
  const visible = filter === 'changed' ? changed : all;
  const busy = batch !== null;

  return (
    <div className="space-y-4">
      <Panel
        title="Change monitoring"
        actions={
          busy ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              <Square />
              Stop after current ({batch.done}/{batch.total})
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={archived || all.length === 0}
              onClick={() => void rerunAll(all)}
              title={
                archived
                  ? 'Archived engagements record no new runs'
                  : 'Run every tool + target again with its last options'
              }
            >
              <RotateCw />
              Re-run all ({all.length})
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs text-muted-foreground">
            The latest run of each tool and target, compared with the run before
            it. Re-run them to see what changed since.
          </p>
          <Segmented<Filter>
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'changed', label: `Changed (${changed.length})` },
              { value: 'all', label: `All (${all.length})` },
            ]}
          />
        </div>
      </Panel>

      {compare && (
        <RunDiffPanel
          before={compare[0]}
          after={compare[1]}
          onClose={() => setCompare(null)}
        />
      )}

      {visible.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {all.length === 0
            ? 'No successful runs in this engagement yet.'
            : 'No changes between the last two runs of any tool and target. Re-run them to check again.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => (
            <ChangeRow
              key={pairKey(c)}
              c={c}
              state={reruns[pairKey(c)]}
              disabled={archived || busy}
              onRerun={() => void rerun(c)}
              onCompare={() =>
                c.before && setCompare([c.before.id, c.after.id])
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ChangeRow({
  c,
  state,
  disabled,
  onRerun,
  onCompare,
}: {
  c: RunChanges;
  state?: RerunState;
  disabled: boolean;
  onRerun: () => void;
  onCompare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tool = getTool(c.tool);
  const Icon = tool.icon;
  const running = state?.status === 'running';
  const expandable = c.items.length > 0 || c.rawDifferences > 0;

  return (
    <li className="border border-border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={!expandable}
          aria-expanded={open}
          aria-label={open ? 'Hide changes' : 'Show changes'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown /> : <ChevronRight />}
        </Button>
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="font-semibold">{tool.name}</span>{' '}
            <span className="text-muted-foreground">·</span>{' '}
            <span className="break-all">{c.target}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            {c.before
              ? `${formatDateTime(c.before.startedAt)} → ${formatDateTime(c.after.startedAt)}`
              : `First run ${formatDateTime(c.after.startedAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!c.before ? (
            <Tag tone="muted">first run</Tag>
          ) : c.items.length ? (
            <ChangeCounts items={c.items} />
          ) : c.rawDifferences ? (
            <Tag tone="muted">{c.rawDifferences} raw</Tag>
          ) : (
            <Tag tone="green">no changes</Tag>
          )}
          {c.inputChanged && <Tag tone="yellow">options differ</Tag>}
          {c.before && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Compare raw output"
              title="Compare raw output"
              onClick={onCompare}
            >
              <GitCompareArrows />
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" asChild>
            <Link
              to={tool.path}
              search={{ run: c.after.id }}
              aria-label={`Open latest ${tool.name} run on ${c.target}`}
              title="Open latest run"
            >
              <ExternalLink />
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || running}
            onClick={onRerun}
          >
            {running ? <Loader2 className="animate-spin" /> : <RotateCw />}
            Re-run
          </Button>
        </div>
      </div>
      {state?.status === 'error' && (
        <div className="border-t border-border px-3 py-2">
          <ErrorText error={state.error} />
        </div>
      )}
      {open && expandable && (
        <div className="border-t border-border px-3 py-3">
          <ChangeList changes={c} />
        </div>
      )}
    </li>
  );
}
