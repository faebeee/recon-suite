import type { ToolId } from '@recon/shared';
import { StatusDot } from '@/components/cyber';
import { formatDateTime } from '@/lib/format';
import { useLastRunSummary } from '@/lib/last-runs';
import { cn } from '@/lib/utils';

/**
 * Green dot when the tool has a saved successful run (pulsing while a run is in
 * progress). Failed last runs are not marked. Renders nothing otherwise.
 */
export function LastRunDot({
  toolId,
  className,
}: {
  toolId: ToolId;
  className?: string;
}) {
  const run = useLastRunSummary(toolId);
  if (!run || run.status === 'error') return null;
  const label =
    run.status === 'running'
      ? `Running against ${run.target}`
      : `Saved run: ${run.target}${run.finishedAt ? `, ${formatDateTime(run.finishedAt)}` : ''}`;
  return (
    <span
      title={label}
      data-slot="last-run-dot"
      className={cn('inline-flex shrink-0 items-center', className)}
    >
      <StatusDot tone="green" pulse={run.status === 'running'} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
