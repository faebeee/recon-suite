import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { isScoredTool, type ToolId } from '@recon/shared';
import { Panel, ScoreChart } from '@/components/cyber';
import { postureQuery, useActiveEngagement } from '@/lib/engagement';
import { scoreLines } from '@/lib/posture';

/**
 * Score history of one module in the active engagement. Rendered by `ToolPage`;
 * nothing for modules without a score or when no engagement is active.
 */
export function ToolScoreHistory({ toolId }: { toolId: ToolId }) {
  const scored = isScoredTool(toolId);
  const { id, engagement } = useActiveEngagement();
  const posture = useQuery({
    ...postureQuery(id ?? ''),
    enabled: !!id && scored,
  });
  if (!scored || !id || !posture.data) return null;

  const { lines, hidden } = scoreLines(
    posture.data.filter((s) => s.tool === toolId),
  );

  return (
    <Panel
      title="Score history"
      actions={
        <Link
          to="/engagements/$engagementId"
          params={{ engagementId: id }}
          className="inline-flex items-center gap-1 text-[11px] tracking-[0.15em] text-primary uppercase underline-offset-4 hover:underline"
        >
          {engagement?.name ?? 'Engagement'}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      }
    >
      {lines.length > 0 ? (
        <div className="space-y-2">
          <ScoreChart lines={lines} showTool={false} />
          {hidden > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing the {lines.length} most recently run targets; {hidden}{' '}
              more in the engagement's posture history.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No runs of this module in the active engagement yet. Each run's score
          is charted here per target.
        </p>
      )}
    </Panel>
  );
}
