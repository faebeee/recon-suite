import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Info,
  XCircle,
} from 'lucide-react';
import {
  FINDING_STATUS_ORDER,
  type Engagement,
  type EngagementFinding,
  type FindingStatus,
} from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { getTool } from '@/features/registry';
import { formatDateTime } from '@/lib/format';
import { FINDING_TONE, toneText } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { PosturePanel } from './posture-panel';
import { findingsQuery } from './queries';
import { ErrorText } from './ui';

const ICON = {
  pass: CheckCircle2,
  warn: CircleAlert,
  fail: XCircle,
  info: Info,
};

const STATUS_LABEL: Record<FindingStatus, string> = {
  fail: 'Failed checks',
  warn: 'Warnings',
  info: 'Information',
  pass: 'Passed checks',
};

export function OverviewTab({ engagement: e }: { engagement: Engagement }) {
  const findings = useQuery(findingsQuery(e.id));
  const f = e.counts.findings;

  return (
    <div className="space-y-4">
      <Panel title="Summary">
        <KeyValueGrid
          className="grid-cols-2 sm:grid-cols-4"
          items={[
            { label: 'Scope entries', value: e.counts.scope },
            { label: 'Runs', value: e.counts.runs },
            { label: 'Notes', value: e.counts.notes },
            {
              label: 'Findings',
              value: (
                <span className="flex flex-wrap gap-1">
                  <Tag tone="magenta">{f.fail} fail</Tag>
                  <Tag tone="yellow">{f.warn} warn</Tag>
                  <Tag tone="cyan">{f.info} info</Tag>
                  <Tag tone="green">{f.pass} pass</Tag>
                </span>
              ),
            },
          ]}
        />
      </Panel>

      <PosturePanel engagementId={e.id} />

      {findings.isPending ? (
        <p className="text-sm text-muted-foreground">Loading findings…</p>
      ) : findings.isError ? (
        <ErrorText error={findings.error} />
      ) : findings.data.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No findings yet. Run tools while this engagement is active; graded
          checks from the latest run per tool and target show up here.
        </p>
      ) : (
        FINDING_STATUS_ORDER.map((status) => {
          const items = findings.data.filter((x) => x.status === status);
          if (!items.length) return null;
          return (
            <Panel
              key={status}
              title={`${STATUS_LABEL[status]} (${items.length})`}
              tone={FINDING_TONE[status]}
              bodyClassName="p-0"
            >
              <EngagementFindingsList findings={items} />
            </Panel>
          );
        })
      )}
    </div>
  );
}

function EngagementFindingsList({
  findings,
}: {
  findings: EngagementFinding[];
}) {
  return (
    <ul className="divide-y divide-border">
      {findings.map((f) => {
        const Icon = ICON[f.status];
        const tool = getTool(f.tool);
        return (
          <li
            key={`${f.runId}:${f.id}`}
            className="flex items-start gap-3 px-4 py-2.5 text-sm"
          >
            <Icon
              aria-label={f.status}
              className={cn(
                'mt-0.5 size-4 shrink-0',
                toneText[FINDING_TONE[f.status]],
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.message}</p>
              {f.value && (
                <code
                  className="block text-xs break-all text-foreground/70"
                  title={f.value}
                >
                  {f.value}
                </code>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <Tag tone={tool.tone} accent>
                  {tool.name}
                </Tag>
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  <span className="break-all text-primary">{f.target}</span>
                  <PivotLinks value={f.target} />
                </span>
                <span className="text-muted-foreground">
                  {formatDateTime(f.observedAt)}
                </span>
                <Link
                  to={tool.path}
                  search={{ run: f.runId }}
                  className="inline-flex items-center gap-1 text-[11px] tracking-[0.15em] text-primary uppercase underline-offset-4 hover:underline"
                >
                  <ExternalLink className="size-3" aria-hidden />
                  Open run
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
