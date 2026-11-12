import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ToolId } from '@recon/shared';
import { Tag } from '@/components/cyber';
import { getTool } from '@/features/registry';
import { cn } from '@/lib/utils';
import { toneText } from '@/lib/tones';

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
          <span className={toneText[tool.tone]}>{tool.code}</span>
          <span>/</span>
          <span>{tool.category}</span>
          <Tag tone={tool.mode === 'active' ? 'yellow' : 'green'}>
            {tool.mode}
          </Tag>
        </div>
        <h1 className="flex items-center gap-3 text-2xl font-bold uppercase sm:text-3xl">
          <Icon className={cn('size-7 shrink-0', toneText[tool.tone])} />
          <span className="text-glow">{tool.name}</span>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {tool.description}
        </p>
        {tool.mode === 'active' && (
          <p className="flex items-start gap-2 text-xs text-neon-yellow/90">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            Active tool: connects directly to the target. Only probe systems you
            own or are authorised to test.
          </p>
        )}
      </header>
      {children}
    </div>
  );
}
