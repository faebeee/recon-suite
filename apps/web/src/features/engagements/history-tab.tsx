import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GitCompareArrows,
  Loader2,
  Pencil,
  X,
} from 'lucide-react';
import { useDeferredValue, useId, useState } from 'react';
import {
  ENGAGEMENT_API,
  runPatchSchema,
  type RunPatch,
  type RunSummary,
} from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getTool, TOOLS } from '@/features/registry';
import { apiDelete, apiPatch, type ApiError } from '@/lib/api-client';
import { ENGAGEMENTS_KEY, RUNS_KEY } from '@/lib/engagement';
import { formatDateTime, formatMs } from '@/lib/format';
import { RunDiffPanel } from './run-diff';
import { runsQuery } from './queries';
import {
  ConfirmDelete,
  ErrorText,
  Field,
  FindingCountTags,
  parseTags,
} from './ui';

const PAGE_SIZE = 50;
const ALL = '__all__';

export function HistoryTab({ engagementId }: { engagementId: string }) {
  const id = useId();
  const [tool, setTool] = useState<string>(ALL);
  const [target, setTarget] = useState('');
  const [tag, setTag] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<RunSummary[]>([]);
  const [compare, setCompare] = useState<[string, string] | null>(null);

  const filters = {
    tool: tool === ALL ? undefined : tool,
    target: useDeferredValue(target.trim()) || undefined,
    tag: useDeferredValue(tag.trim().toLowerCase()) || undefined,
    limit: PAGE_SIZE,
    offset,
  };
  const runs = useQuery(runsQuery(engagementId, filters));

  const resetPaging = () => setOffset(0);
  const toggle = (run: RunSummary, checked: boolean) => {
    setCompare(null);
    setSelected((prev) =>
      checked
        ? [...prev.filter((r) => r.id !== run.id), run].slice(-2)
        : prev.filter((r) => r.id !== run.id),
    );
  };

  const [a, b] = selected;
  const canCompare = selected.length === 2 && a!.tool === b!.tool;
  const startCompare = () => {
    if (!a || !b) return;
    const [before, after] = a.startedAt <= b.startedAt ? [a, b] : [b, a];
    setCompare([before.id, after.id]);
  };

  const total = runs.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <Panel title="Filters">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tool" htmlFor={`${id}-tool`}>
            <Select
              value={tool}
              onValueChange={(v) => {
                setTool(v);
                resetPaging();
              }}
            >
              <SelectTrigger id={`${id}-tool`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All tools</SelectItem>
                {TOOLS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target" htmlFor={`${id}-target`}>
            <Input
              id={`${id}-target`}
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                resetPaging();
              }}
              maxLength={260}
              placeholder="contains…"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Tag" htmlFor={`${id}-tag`}>
            <Input
              id={`${id}-tag`}
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                resetPaging();
              }}
              maxLength={40}
              placeholder="e.g. baseline"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          {selected.length === 0
            ? 'Select two runs of the same tool to compare them.'
            : selected.length === 1
              ? 'Select one more run of the same tool.'
              : canCompare
                ? 'Two runs selected.'
                : 'The selected runs belong to different tools.'}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={!canCompare}
          onClick={startCompare}
        >
          <GitCompareArrows />
          Compare
        </Button>
        {selected.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelected([]);
              setCompare(null);
            }}
          >
            <X />
            Clear selection
          </Button>
        )}
      </div>

      {compare && (
        <RunDiffPanel
          before={compare[0]}
          after={compare[1]}
          onClose={() => setCompare(null)}
        />
      )}

      <Panel
        title={`Runs${runs.data ? ` (${total})` : ''}`}
        bodyClassName="p-0"
        actions={
          runs.isFetching && (
            <Loader2
              className="size-3.5 animate-spin text-primary"
              aria-label="Loading"
            />
          )
        }
      >
        {runs.isPending ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
        ) : runs.isError ? (
          <div className="px-4 py-3">
            <ErrorText error={runs.error} />
          </div>
        ) : runs.data.items.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No runs match. Tool runs are recorded while this engagement is
            active.
          </p>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <span className="sr-only">Select</span>
                </TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.data.items.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  checked={selected.some((r) => r.id === run.id)}
                  onCheckedChange={(c) => toggle(run, c)}
                  onDeleted={() => toggle(run, false)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      {total > PAGE_SIZE && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
        >
          <span>
            {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <span className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft />
              Newer
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Older
              <ChevronRight />
            </Button>
          </span>
        </nav>
      )}
    </div>
  );
}

function RunRow({
  run,
  checked,
  onCheckedChange,
  onDeleted,
}: {
  run: RunSummary;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const tool = getTool(run.tool);
  const remove = useMutation<void, ApiError>({
    mutationFn: () => apiDelete(ENGAGEMENT_API.run(run.id)),
    onSuccess: () => {
      onDeleted();
      queryClient.removeQueries({ queryKey: [...RUNS_KEY, run.id] });
      void queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
    },
  });

  return (
    <TableRow data-state={checked ? 'selected' : undefined}>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={(c) => onCheckedChange(c === true)}
          aria-label={`Select ${tool.name} run on ${run.target}`}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatDateTime(run.startedAt)}
        <span className="block text-[10px]">{formatMs(run.durationMs)}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap">{tool.name}</TableCell>
      <TableCell className="max-w-56 break-all whitespace-normal text-primary">
        {run.target}
      </TableCell>
      <TableCell>
        {run.status === 'ok' ? (
          <Tag tone="green">ok</Tag>
        ) : (
          <span title={run.error?.message}>
            <Tag tone="magenta">
              error{run.error ? ` ${run.error.status}` : ''}
            </Tag>
          </span>
        )}
      </TableCell>
      <TableCell>
        <FindingCountTags counts={run.findingCounts} />
      </TableCell>
      <TableCell className="min-w-40">
        <TagsEditor run={run} />
      </TableCell>
      <TableCell>
        <span className="flex items-center justify-end gap-1">
          <Button asChild size="icon-sm" variant="ghost">
            <Link
              to={tool.path}
              search={{ run: run.id }}
              aria-label={`Open ${tool.name} run on ${run.target}`}
              title="Open run"
            >
              <ExternalLink />
            </Link>
          </Button>
          <ConfirmDelete
            label={`Delete ${tool.name} run on ${run.target}`}
            pending={remove.isPending}
            onConfirm={() => remove.mutate()}
          />
        </span>
        <ErrorText error={remove.error} />
      </TableCell>
    </TableRow>
  );
}

/** Inline, comma separated tag editing (PATCH run). */
function TagsEditor({ run }: { run: RunSummary }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [validation, setValidation] = useState<string | null>(null);

  const patch = useMutation<RunSummary, ApiError, RunPatch>({
    mutationFn: (body) => apiPatch(ENGAGEMENT_API.run(run.id), body),
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...RUNS_KEY, run.id] });
    },
  });

  if (!editing) {
    return (
      <span className="flex flex-wrap items-center gap-1">
        {run.tags.map((t) => (
          <Tag key={t} tone="muted">
            {t}
          </Tag>
        ))}
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Edit tags of ${run.target} run`}
          title="Edit tags"
          onClick={() => {
            setValue(run.tags.join(', '));
            setValidation(null);
            patch.reset();
            setEditing(true);
          }}
        >
          <Pencil />
        </Button>
      </span>
    );
  }

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = runPatchSchema.safeParse({ tags: parseTags(value) });
        if (!parsed.success) {
          setValidation(parsed.error.issues[0]?.message ?? 'Invalid tags');
          return;
        }
        setValidation(null);
        patch.mutate(parsed.data);
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label={`Tags of ${run.target} run, comma separated`}
        placeholder="baseline, retest"
        autoFocus
        className="h-7 text-xs"
      />
      <span className="flex gap-1">
        <Button type="submit" size="xs" disabled={patch.isPending}>
          {patch.isPending && <Loader2 className="animate-spin" />}
          Save
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </span>
      <ErrorText error={validation ?? patch.error} />
    </form>
  );
}
