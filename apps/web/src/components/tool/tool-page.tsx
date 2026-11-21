import { Link } from '@tanstack/react-router';
import { AlertTriangle, FolderKanban, HardDrive } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ToolId } from '@recon/shared';
import { Tag } from '@/components/cyber';
import { getTool } from '@/features/registry';
import { useActiveEngagement } from '@/lib/engagement';
import { cn } from '@/lib/utils';
import { toneText } from '@/lib/tones';
import { RuntimeDetails } from './runtime-badge';
import { ToolScoreHistory } from './score-history';

/** Standard layout for a tool: header from the catalog, then form, then results. */
export function ToolPage({
  toolId,
  children,
}: {
  toolId: ToolId;
  children: ReactNode;
}) {
  const tool = getTool(toolId);
  const Icon = tool.icon;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          <span data-accent className={toneText[tool.tone]}>
            {tool.code}
          </span>
          <span>/</span>
          <span>{tool.category}</span>
          <Tag tone={tool.mode === 'active' ? 'yellow' : 'green'}>
            {tool.mode}
          </Tag>
        </div>
        <h1 className="flex items-center font-dot gap-3 text-2xl font-bold uppercase sm:text-3xl">
          <Icon
            data-accent
            className={cn('size-7 shrink-0', toneText[tool.tone])}
          />
          <span className="text-glow">{tool.name}</span>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {tool.description}
        </p>
        <RuntimeDetails toolId={toolId} />
        {tool.scope === 'local' && (
          <p className="flex items-start gap-2 text-xs text-primary/90">
            <HardDrive className="mt-px size-3.5 shrink-0" />
            Local tool: runs on the machine hosting the API and inspects its
            surroundings, not a remote target.
          </p>
        )}
        {tool.mode === 'active' && (
          <p className="flex items-start gap-2 text-xs text-neon-yellow/90">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            Active tool: connects directly to the target. Only probe systems you
            own or are authorised to test.
          </p>
        )}
      </header>
      <EngagementBanner />
      {children}
      <ToolScoreHistory toolId={toolId} />
    </div>
  );
}

/** Slim notice that runs are recorded to the active engagement. */
function EngagementBanner() {
  const { id, engagement } = useActiveEngagement();
  if (!id) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs">
      <FolderKanban className="size-3.5 shrink-0 text-primary" aria-hidden />
      <span className="text-muted-foreground">
        Recording to{' '}
        <Link
          to="/engagements/$engagementId"
          params={{ engagementId: id }}
          className="text-primary underline-offset-4 hover:underline"
        >
          {engagement?.name ?? 'engagement'}
        </Link>
      </span>
    </div>
  );
}
