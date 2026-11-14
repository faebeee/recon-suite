import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { SCORED_TOOLS } from '@recon/shared';
import { Panel, ScoreChart, Tag } from '@/components/cyber';
import { getTool } from '@/features/registry';
import { postureQuery, useActiveEngagement } from '@/lib/engagement';
import { latestDnssec, scoreLines } from '@/lib/posture';
import { DNSSEC_TONE } from '@/lib/tones';

/** Score/grade history of the active engagement (nothing when none is active). */
export function ScoreHistoryPanel() {
  const { id } = useActiveEngagement();
  const posture = useQuery({ ...postureQuery(id ?? ''), enabled: !!id });
  if (!id || !posture.data) return null;

  const { lines, hidden } = scoreLines(posture.data);
  const dnssec = latestDnssec(posture.data);
  if (!lines.length && !dnssec.length) return null;

  const dnssecTool = getTool('dnssec');
  const scoredNames = SCORED_TOOLS.map((t) => getTool(t).name).join(', ');
  return (
    <Panel
      title="Score history"
      actions={
        <Link
          to="/engagements/$engagementId"
          params={{ engagementId: id }}
          className="inline-flex items-center gap-1 text-[11px] tracking-[0.15em] text-primary uppercase underline-offset-4 hover:underline"
        >
          All runs
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      }
    >
      <div className="space-y-4">
        {lines.length > 0 ? (
          <ScoreChart lines={lines} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No graded runs yet: run {scoredNames} to chart scores.
          </p>
        )}
        {hidden > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing the {lines.length} most recently run targets; {hidden} more
            in the engagement's posture history.
          </p>
        )}
        {dnssec.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
            <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              {dnssecTool.name}
            </span>
            {dnssec.map((d) => (
              <Link
                key={d.target}
                to={dnssecTool.path}
                search={{ run: d.runId }}
                className="inline-flex items-center gap-1.5 hover:text-primary"
              >
                <span className="break-all">{d.target}</span>
                <Tag tone={DNSSEC_TONE[d.status]}>{d.status}</Tag>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
