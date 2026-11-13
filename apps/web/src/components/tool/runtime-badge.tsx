import { Cpu, Globe2, Wrench } from 'lucide-react';
import type { ToolId, ToolRuntime } from '@recon/shared';
import { StatusDot, Tag } from '@/components/cyber';
import { LOCATION_META, STATUS_TONE, useToolRuntime } from '@/lib/runtime';
import { cn } from '@/lib/utils';
import { toneText } from '@/lib/tones';

/** Plain-text summary for tooltips and screen readers. */
export function runtimeSummary(r: ToolRuntime): string {
  const where = LOCATION_META[r.location].label;
  const parts = [`Runs in: ${where}`, `Engine: ${r.engine}`];
  if (r.via) parts.push(`Via: ${r.via}`);
  if (r.services.length) parts.push(`Services: ${r.services.join(', ')}`);
  if (r.status !== 'ok') parts.push(`Status: ${r.status}`);
  return parts.join('. ');
}

/**
 * Compact location tag (host / ctr / kali) with a status dot when the tool is not fully
 * available. Renders nothing until the runtime is known.
 */
export function RuntimeBadge({
  toolId,
  compact = false,
  className,
}: {
  toolId: ToolId;
  compact?: boolean;
  className?: string;
}) {
  const runtime = useToolRuntime(toolId);
  if (!runtime) return null;
  const meta = LOCATION_META[runtime.location];
  const Icon = meta.icon;
  const summary = runtimeSummary(runtime);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      title={summary}
    >
      <span className="sr-only">{summary}</span>
      <Tag
        tone={meta.tone}
        className={cn(compact && 'px-1 text-[9px] tracking-[0.1em]')}
      >
        <Icon className="size-3" aria-hidden />
        <span aria-hidden>{compact ? meta.short : meta.label}</span>
      </Tag>
      {runtime.status !== 'ok' && (
        <span aria-hidden>
          <StatusDot tone={STATUS_TONE[runtime.status]} />
        </span>
      )}
    </span>
  );
}

/** Full runtime line for the tool page header: location, engine, via, services, status. */
export function RuntimeDetails({ toolId }: { toolId: ToolId }) {
  const runtime = useToolRuntime(toolId);
  if (!runtime) return null;
  const meta = LOCATION_META[runtime.location];
  return (
    <div className="space-y-1.5 border-l-2 border-border pl-3 text-xs">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <RuntimeBadge toolId={toolId} />
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Cpu className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Engine:</span>
          <span className="text-foreground">{runtime.engine}</span>
        </span>
        {runtime.via && (
          <code className="text-[11px] text-muted-foreground">
            {runtime.via}
          </code>
        )}
        {runtime.services.length > 0 && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Globe2 className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Third-party services:</span>
            {runtime.services.join(', ')}
          </span>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground">{meta.description}</p>
      {runtime.status !== 'ok' && (
        <p className="flex items-start gap-1.5">
          <Wrench
            className={cn(
              'mt-px size-3.5 shrink-0',
              toneText[STATUS_TONE[runtime.status]],
            )}
            aria-hidden
          />
          <span>
            <span
              className={cn(
                'font-semibold uppercase',
                toneText[STATUS_TONE[runtime.status]],
              )}
            >
              {runtime.status}
            </span>
            {runtime.reason && (
              <span className="text-muted-foreground"> {runtime.reason}</span>
            )}
            {runtime.fix && (
              <span className="block text-muted-foreground">
                Fix: <span className="text-foreground">{runtime.fix}</span>
              </span>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
