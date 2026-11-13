import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Play,
  Square,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ENGAGEMENT_API,
  toolEndpoint,
  type ScopeEntry,
  type ToolId,
  type ToolResult,
} from '@recon/shared';
import { ChipToggle, Meter, Panel, Tag } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getTool } from '@/features/registry';
import { ApiError, apiFetch, apiPost } from '@/lib/api-client';
import { ENGAGEMENTS_KEY, useActiveEngagement } from '@/lib/engagement';
import {
  BATCH_CONCURRENCY,
  BATCH_TOOLS,
  countFindings,
  JOB_TONE,
  MAX_BATCH_JOBS,
  MAX_RATE_LIMIT_RETRIES,
  parseTargets,
  planJobs,
  RATE_LIMIT_WAIT_MS,
  sleep,
  type Job,
} from './batch-jobs';

const labelClass =
  'text-[10px] tracking-[0.2em] text-muted-foreground uppercase';

export function BatchPage() {
  const id = useId();
  const queryClient = useQueryClient();
  const active = useActiveEngagement();
  const [text, setText] = useState('');
  const [tools, setTools] = useState<ToolId[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [scopeNote, setScopeNote] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  // Stop the queue when leaving the page.
  useEffect(() => () => controller.current?.abort(), []);

  const targets = useMemo(() => parseTargets(text), [text]);
  const planned = useMemo(() => planJobs(targets, tools), [targets, tools]);
  const tooMany = planned.length > MAX_BATCH_JOBS;
  const activeSelected = tools.some((t) => getTool(t).mode === 'active');

  const loadScope = useMutation<ScopeEntry[], ApiError, string>({
    mutationFn: (engagementId) =>
      queryClient.fetchQuery({
        queryKey: [...ENGAGEMENTS_KEY, engagementId, 'scope'],
        queryFn: () =>
          apiFetch<ScopeEntry[]>(ENGAGEMENT_API.scope(engagementId)),
      }),
    onSuccess: (entries) => {
      const usable = entries.filter(
        (e) => !e.excluded && (e.kind === 'domain' || e.kind === 'ip'),
      );
      const skipped = entries.filter(
        (e) => !e.excluded && (e.kind === 'wildcard' || e.kind === 'cidr'),
      ).length;
      setText(usable.map((e) => e.value).join('\n'));
      setScopeNote(
        `Loaded ${usable.length} in-scope ${usable.length === 1 ? 'entry' : 'entries'}.` +
          (skipped
            ? ` Skipped ${skipped} wildcard/CIDR ${skipped === 1 ? 'entry' : 'entries'}: add concrete hosts to batch them.`
            : ''),
      );
    },
  });

  const update = (key: string, patch: Partial<Job>) =>
    setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  async function runJob(job: Job, signal: AbortSignal) {
    update(job.key, { status: 'running', note: undefined });
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await apiPost<ToolResult<unknown>>(
          toolEndpoint(job.tool),
          job.input,
          { signal },
        );
        update(job.key, { status: 'ok', note: undefined, result });
        return;
      } catch (err) {
        if (signal.aborted) {
          update(job.key, { status: 'cancelled', note: undefined });
          return;
        }
        if (
          err instanceof ApiError &&
          err.status === 429 &&
          attempt < MAX_RATE_LIMIT_RETRIES
        ) {
          update(job.key, {
            note: `rate limited, waiting (retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`,
          });
          await sleep(RATE_LIMIT_WAIT_MS, signal);
          if (signal.aborted) {
            update(job.key, { status: 'cancelled', note: undefined });
            return;
          }
          update(job.key, { note: undefined });
          continue;
        }
        update(job.key, {
          status: 'error',
          note: undefined,
          error: err instanceof Error ? err.message : 'Request failed',
        });
        return;
      }
    }
  }

  async function start() {
    if (running || tooMany || !planned.length) return;
    const ctl = new AbortController();
    controller.current = ctl;
    setJobs(planned);
    setRunning(true);

    const queue = planned.filter((j) => j.status === 'queued');
    const worker = async () => {
      while (!ctl.signal.aborted) {
        const job = queue.shift();
        if (!job) return;
        await runJob(job, ctl.signal);
      }
    };
    await Promise.all(Array.from({ length: BATCH_CONCURRENCY }, worker));

    if (ctl.signal.aborted) {
      setJobs((js) =>
        js.map((j) =>
          j.status === 'queued' ? { ...j, status: 'cancelled' } : j,
        ),
      );
    }
    if (controller.current === ctl) {
      controller.current = null;
      setRunning(false);
    }
    void queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
  }

  const stop = () => controller.current?.abort();

  const finished = jobs.filter(
    (j) => j.status !== 'queued' && j.status !== 'running',
  ).length;
  const progress = jobs.length ? Math.round((finished / jobs.length) * 100) : 0;
  const counts = {
    ok: jobs.filter((j) => j.status === 'ok').length,
    error: jobs.filter((j) => j.status === 'error').length,
    invalid: jobs.filter((j) => j.status === 'invalid').length,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          Workspace
        </p>
        <h1 className="font-dot text-2xl font-bold uppercase sm:text-3xl">
          <span className="text-glow">Batch runs</span>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Run several tools against a list of targets with their default
          options. Each target only runs with the tools that accept its kind
          (domain, IP or URL).
        </p>
        <p className="flex items-start gap-2 text-xs text-neon-yellow/90">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          Active tools contact every target in the list. Only include systems
          you own or are authorised to test.
        </p>
        {active.id ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info
              className="mt-px size-3.5 shrink-0 text-primary"
              aria-hidden
            />
            <span>
              Results are saved to{' '}
              <Link
                to="/engagements/$engagementId"
                params={{ engagementId: active.id }}
                className="text-primary underline-offset-4 hover:underline"
              >
                {active.engagement?.name ?? 'the active engagement'}
              </Link>
              ; active tools only run against in-scope targets.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info
              className="mt-px size-3.5 shrink-0 text-primary"
              aria-hidden
            />
            <span>
              No engagement is active, so results are not saved.{' '}
              <Link
                to="/engagements"
                className="text-primary underline-offset-4 hover:underline"
              >
                Choose or create one
              </Link>{' '}
              to keep them.
            </span>
          </p>
        )}
      </header>

      <Panel title="Setup" bodyClassName="space-y-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label htmlFor={`${id}-targets`} className={labelClass}>
              Targets (one per line)
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!active.id || loadScope.isPending || running}
              title={
                active.id
                  ? undefined
                  : 'Activate an engagement to use its scope'
              }
              onClick={() => active.id && loadScope.mutate(active.id)}
            >
              {loadScope.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              Load in-scope entries
            </Button>
          </div>
          <textarea
            id={`${id}-targets`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={running}
            rows={6}
            spellCheck={false}
            autoCapitalize="none"
            placeholder={'example.com\n192.0.2.10\nhttps://app.example.com'}
            className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          />
          <p className="text-xs text-muted-foreground">
            {targets.length} {targets.length === 1 ? 'target' : 'targets'}
          </p>
          {scopeNote && <p className="text-xs text-primary">{scopeNote}</p>}
          {loadScope.error && (
            <p role="alert" className="text-xs text-neon-magenta">
              ! {loadScope.error.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span id={`${id}-tools`} className={labelClass}>
              Tools
            </span>
            <span className="flex gap-1">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={running}
                onClick={() =>
                  setTools(
                    BATCH_TOOLS.filter((t) => t.mode === 'passive').map(
                      (t) => t.id,
                    ),
                  )
                }
              >
                Passive only
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={running}
                onClick={() => setTools(BATCH_TOOLS.map((t) => t.id))}
              >
                All
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={running}
                onClick={() => setTools([])}
              >
                None
              </Button>
            </span>
          </div>
          <fieldset disabled={running} aria-labelledby={`${id}-tools`}>
            <ChipToggle
              label="Tools"
              options={BATCH_TOOLS.map((t) => ({
                value: t.id,
                label: t.mode === 'active' ? `${t.name} *` : t.name,
              }))}
              value={tools}
              onChange={setTools}
            />
          </fieldset>
          <p className="text-xs text-muted-foreground">
            * active tool (connects to the target)
          </p>
          {activeSelected && (
            <p className="flex items-start gap-2 text-xs text-neon-yellow/90">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              Active tools selected: every matching target will be probed
              directly.
            </p>
          )}
        </div>

        <div className="space-y-2">
          {tooMany && (
            <p role="alert" className="text-xs text-neon-magenta">
              ! {planned.length} jobs planned; the limit is {MAX_BATCH_JOBS}.
              Remove targets or tools.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {running ? (
              <Button type="button" variant="outline" onClick={stop}>
                <Square />
                Stop
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void start()}
                disabled={!planned.length || tooMany}
              >
                <Play />
                Run {planned.length} {planned.length === 1 ? 'job' : 'jobs'}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {planned.length
                ? `${targets.length} targets x ${tools.length} tools, ${BATCH_CONCURRENCY} at a time`
                : 'Enter targets and pick tools that accept them.'}
            </span>
          </div>
        </div>
      </Panel>

      {jobs.length > 0 && (
        <Panel
          title="Results"
          bodyClassName="p-0"
          actions={
            running && (
              <Loader2
                className="size-3.5 animate-spin text-primary"
                aria-label="Running"
              />
            )
          }
        >
          <div className="space-y-2 border-b border-border px-4 py-3">
            <Meter value={progress} tone={counts.error ? 'yellow' : 'cyan'} />
            <p
              className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] tracking-wider text-muted-foreground uppercase"
              aria-live="polite"
            >
              <span>
                done{' '}
                <span className="text-foreground">
                  {finished}/{jobs.length}
                </span>
              </span>
              <span>
                ok <span className="text-neon-green">{counts.ok}</span>
              </span>
              <span>
                error <span className="text-neon-magenta">{counts.error}</span>
              </span>
              <span>
                invalid{' '}
                <span className="text-neon-yellow">{counts.invalid}</span>
              </span>
            </p>
          </div>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Target</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <JobRow key={job.key} job={job} />
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const tool = getTool(job.tool);
  const f = countFindings(job.result);
  const runId = job.result?.runId;
  return (
    <TableRow>
      <TableCell className="max-w-56 break-all whitespace-normal text-primary">
        {job.target}
      </TableCell>
      <TableCell className="whitespace-nowrap">{tool.name}</TableCell>
      <TableCell>
        <Tag tone={JOB_TONE[job.status]}>
          {job.status === 'running' && (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          )}
          {job.status}
        </Tag>
      </TableCell>
      <TableCell>
        {job.status === 'ok' && (f.fail || f.warn) ? (
          <span className="inline-flex gap-1">
            {f.fail > 0 && <Tag tone="magenta">{f.fail} fail</Tag>}
            {f.warn > 0 && <Tag tone="yellow">{f.warn} warn</Tag>}
          </span>
        ) : (
          <span className="text-muted-foreground/60">-</span>
        )}
      </TableCell>
      <TableCell className="max-w-72 whitespace-normal">
        {job.note ? (
          <span className="text-neon-yellow">{job.note}</span>
        ) : job.error ? (
          <span
            className={
              job.status === 'invalid'
                ? 'text-neon-yellow'
                : 'text-neon-magenta'
            }
          >
            {job.error}
          </span>
        ) : null}
      </TableCell>
      <TableCell>
        {job.status === 'ok' && (
          <Button asChild size="icon-sm" variant="ghost">
            {runId ? (
              <Link
                to={tool.path}
                search={{ run: runId }}
                aria-label={`Open saved ${tool.name} run on ${job.target}`}
                title="Open saved run"
              >
                <ExternalLink />
              </Link>
            ) : (
              <Link
                to={tool.path}
                search={{ target: job.target }}
                aria-label={`Open ${tool.name} with ${job.target}`}
                title="Open in tool (runs again)"
              >
                <ExternalLink />
              </Link>
            )}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
