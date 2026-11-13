import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { KeyRound, RefreshCw } from 'lucide-react';
import {
  SETTING_GROUP_LABELS,
  type SettingGroup,
  type SystemCheck,
  type SystemCheckStatus,
  type SystemOverview,
  type SystemSetting,
} from '@recon/shared';
import { KeyValueGrid, Panel, StatusDot, Tag } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { getTool } from '@/features/registry';
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format';
import { LOCATION_META, STATUS_TONE, runtimeQuery } from '@/lib/runtime';
import { toneBorder, toneText, type Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { systemOverviewQuery } from './system-query';

const CHECK_TONE: Record<SystemCheckStatus, Tone> = {
  ok: 'green',
  warn: 'yellow',
  error: 'magenta',
  off: 'muted',
};

const OVERALL_LABEL: Record<SystemOverview['status'], string> = {
  ok: 'All systems nominal',
  warn: 'Needs attention',
  error: 'Degraded',
};

const GROUPS = Object.keys(SETTING_GROUP_LABELS) as SettingGroup[];

/** System overview: live status checks, API/database facts, tool support and settings. */
export function SystemPage() {
  const query = useQuery(systemOverviewQuery);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] tracking-[0.4em] text-neon-magenta uppercase">
            {'>'} system
          </p>
          <h1 className="font-dot text-3xl font-black uppercase sm:text-4xl">
            System
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Status of the API and its dependencies, and the settings it runs
            with. Secrets are only shown as set or not set.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {query.data && (
            <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
              updated {formatDateTime(query.data.generatedAt).slice(11)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={cn('size-3.5', query.isFetching && 'animate-spin')}
              aria-hidden
            />
            Refresh
          </Button>
        </div>
      </header>

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <Panel title="Error" tone="magenta">
          <p className="text-sm">{query.error.message}</p>
        </Panel>
      ) : (
        <Overview data={query.data} />
      )}
    </div>
  );
}

function Overview({ data }: { data: SystemOverview }) {
  const overallTone = CHECK_TONE[data.status];
  return (
    <>
      <section
        className={cn(
          'grid gap-4 border-l-2 pl-4 sm:grid-cols-2 lg:grid-cols-5',
          toneBorder[overallTone],
        )}
        aria-label="Summary"
      >
        <Stat label="Status">
          <span
            className={cn('flex items-center gap-2', toneText[overallTone])}
          >
            <StatusDot tone={overallTone} pulse={data.status === 'ok'} />
            {OVERALL_LABEL[data.status]}
          </span>
        </Stat>
        <Stat label="Version">v{data.api.version}</Stat>
        <Stat label="Uptime">
          <span title={`Since ${formatDateTime(data.api.startedAt)}`}>
            {formatDuration(data.api.uptimeSeconds)}
          </span>
        </Stat>
        <Stat label="Runs on">
          {LOCATION_META[data.api.location].label}
          <span className="text-muted-foreground">
            {' '}
            ({data.api.platform}/{data.api.arch})
          </span>
        </Stat>
        <Stat label="Memory">
          {formatBytes(data.api.memoryRssBytes)}
          <span className="text-muted-foreground">
            {' '}
            · node {data.api.nodeVersion}
          </span>
        </Stat>
      </section>

      <Panel title="Status checks" bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {data.checks.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Database">
          <KeyValueGrid
            items={[
              {
                label: 'File',
                value: <span className="break-all">{data.database.path}</span>,
              },
              {
                label: 'Size',
                value:
                  data.database.sizeBytes === undefined
                    ? undefined
                    : formatBytes(data.database.sizeBytes),
              },
              { label: 'Engagements', value: data.database.engagements },
              { label: 'Runs', value: data.database.runs },
              { label: 'Notes', value: data.database.notes },
              { label: 'Active sessions', value: data.database.activeSessions },
            ]}
          />
        </Panel>
        <ToolsPanel tools={data.tools} />
      </div>

      <Panel title="Settings" bodyClassName="p-0">
        {GROUPS.map((group) => {
          const settings = data.settings.filter((s) => s.group === group);
          if (!settings.length) return null;
          return (
            <section
              key={group}
              className="border-b border-border last:border-0"
            >
              <h3 className="px-4 pt-3 pb-1 text-[10px] tracking-[0.3em] text-primary uppercase">
                {SETTING_GROUP_LABELS[group]}
              </h3>
              <dl className="divide-y divide-border/50">
                {settings.map((s) => (
                  <SettingRow key={s.key} setting={s} />
                ))}
              </dl>
            </section>
          );
        })}
      </Panel>
    </>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold">{children}</p>
    </div>
  );
}

function CheckRow({ check }: { check: SystemCheck }) {
  const tone = CHECK_TONE[check.status];
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-1.5" aria-hidden>
        <StatusDot tone={tone} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold">{check.label}</p>
        <p className="text-xs text-muted-foreground">{check.detail}</p>
        {check.fix && (
          <p
            className={cn(
              'text-xs',
              toneText[tone === 'muted' ? 'cyan' : tone],
            )}
          >
            {'>'} {check.fix}
          </p>
        )}
      </div>
      <Tag tone={tone} className="mt-0.5 shrink-0">
        {check.status}
      </Tag>
    </li>
  );
}

function ToolsPanel({ tools }: { tools: SystemOverview['tools'] }) {
  const runtime = useQuery(runtimeQuery);
  const problems = runtime.data?.tools.filter((t) => t.status !== 'ok') ?? [];
  return (
    <Panel
      title="Tools"
      actions={
        <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
          {tools.ok}/{tools.total} ready
        </span>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Tag tone={STATUS_TONE.ok}>{tools.ok} ok</Tag>
        {tools.limited > 0 && (
          <Tag tone={STATUS_TONE.limited}>{tools.limited} limited</Tag>
        )}
        {tools.unavailable > 0 && (
          <Tag tone={STATUS_TONE.unavailable}>
            {tools.unavailable} unavailable
          </Tag>
        )}
        {tools.disabled > 0 && (
          <Tag tone={STATUS_TONE.disabled}>{tools.disabled} disabled</Tag>
        )}
      </div>
      {problems.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {problems.map((t) => {
            const tool = getTool(t.id);
            return (
              <li key={t.id} className="flex items-start gap-2 text-xs">
                <span className="mt-1" aria-label={`Status: ${t.status}`}>
                  <StatusDot tone={STATUS_TONE[t.status]} />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <Link
                    to={tool.path}
                    className="font-semibold hover:text-primary"
                  >
                    {tool.name}
                  </Link>
                  {t.reason && (
                    <p className="text-muted-foreground">{t.reason}</p>
                  )}
                  {t.fix && (
                    <p className="text-primary">
                      {'>'} {t.fix}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Every tool works fully on this setup.
        </p>
      )}
    </Panel>
  );
}

function SettingRow({ setting: s }: { setting: SystemSetting }) {
  return (
    <div className="grid gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="min-w-0">
        <code className="text-xs font-semibold break-all">{s.key}</code>
        <p className="text-[11px] text-muted-foreground">{s.description}</p>
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
        {s.secret ? (
          <Tag tone={s.isSet ? 'green' : 'muted'}>
            <KeyRound className="size-3" aria-hidden />
            {s.isSet ? 'set' : 'not set'}
          </Tag>
        ) : s.isSet ? (
          <code className="break-all">{s.value}</code>
        ) : (
          <span className="text-muted-foreground/60">not set</span>
        )}
        {s.isDefault && s.isSet && !s.secret && <Tag tone="muted">default</Tag>}
      </dd>
    </div>
  );
}
