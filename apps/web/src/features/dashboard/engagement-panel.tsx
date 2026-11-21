import { Link } from '@tanstack/react-router';
import { ArrowRight, FolderKanban } from 'lucide-react';
import { Panel, Tag } from '@/components/cyber';
import { useActiveEngagement } from '@/lib/engagement';

/** Active engagement summary, or a hint to create one. */
export function EngagementPanel() {
  const { id, engagement } = useActiveEngagement();

  if (!id) {
    return (
      <Panel title="Engagement" tone="muted">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <FolderKanban className="size-4 text-primary" aria-hidden />
          No engagement active: runs are not saved.
          <Link
            to="/engagements"
            className="text-primary underline-offset-4 hover:underline"
          >
            Create or pick one
          </Link>
          to keep history and findings together.
        </p>
      </Panel>
    );
  }

  const c = engagement?.counts;
  return (
    <Panel
      title="Engagement"
      actions={
        <Link
          to="/engagements/$engagementId"
          params={{ engagementId: id }}
          aria-label="Open engagement"
          className="inline-flex items-center gap-1 text-[11px] tracking-[0.15em] text-primary uppercase underline-offset-4 hover:underline"
        >
          Open
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold tracking-[0.1em] break-all uppercase">
            {engagement?.name ?? 'Loading…'}
          </p>
          {engagement?.client && (
            <p className="text-xs text-muted-foreground">{engagement.client}</p>
          )}
        </div>
        {c && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tracking-wider text-muted-foreground uppercase">
            <span>
              runs <span className="text-foreground">{c.runs}</span>
            </span>
            <span>
              notes <span className="text-foreground">{c.notes}</span>
            </span>
            <Tag tone="magenta">{c.findings.fail} fail</Tag>
            <Tag tone="yellow">{c.findings.warn} warn</Tag>
          </div>
        )}
      </div>
    </Panel>
  );
}
