import { Link } from '@tanstack/react-router';
import { ArrowRight, Pin, PinOff } from 'lucide-react';
import { useState } from 'react';
import { CATEGORY_LABELS, type ToolCategory } from '@recon/shared';
import { GlitchText, Panel, Tag } from '@/components/cyber';
import { TOOLS, toolsAccepting, type ToolEntry } from '@/features/registry';
import { setSessionTarget, useSessionTarget } from '@/lib/session-target';
import { cn } from '@/lib/utils';
import { toneBorder, toneText } from '@/lib/tones';
import { RuntimeBadge } from '@/components/tool';
import { HostPanel } from '@/features/system';
import { EngagementPanel } from './engagement-panel';
import { RuntimePanel } from './runtime-panel';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ToolCategory[];

export function DashboardPage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-[11px] tracking-[0.4em] text-neon-magenta uppercase">
          {'>'} reconnaissance toolkit
        </p>
        <h1 className="font-dot text-4xl font-black uppercase sm:text-6xl">
          <GlitchText text="Recon//Suite" className="text-primary text-glow" />
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          {TOOLS.length} modules for mapping a target's DNS, registration,
          certificates, web surface and exposed services. Passive modules only
          query public sources; active modules touch the target.
        </p>
      </section>

      <QuickTarget />

      <HostPanel />

      <EngagementPanel />

      <RuntimePanel />

      {CATEGORIES.map((cat) => {
        const tools = TOOLS.filter((t) => t.category === cat);
        if (!tools.length) return null;
        return (
          <section key={cat} className="space-y-3">
            <h2 className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
              <span className="text-primary">{'//'}</span>{' '}
              {CATEGORY_LABELS[cat]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolEntry }) {
  const Icon = tool.icon;
  return (
    <Link
      to={tool.path}
      className={cn(
        'group relative flex flex-col gap-3 border bg-card/70 p-5 transition-all clip-corner hover:-translate-y-0.5 hover:bg-card',
        toneBorder[tool.tone],
      )}
    >
      <div className="flex items-start justify-between">
        <Icon
          className={cn(
            'size-6 transition group-hover:text-glow',
            toneText[tool.tone],
          )}
        />
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground">
          {tool.code}
        </span>
      </div>
      <div>
        <h3 className="font-display text-sm font-bold tracking-[0.15em] uppercase group-hover:text-primary">
          {tool.name}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{tool.tagline}</p>
      </div>
      <div className="mt-auto flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Tag tone={tool.mode === 'active' ? 'yellow' : 'green'}>
            {tool.mode}
          </Tag>
          <RuntimeBadge toolId={tool.id} />
        </span>
        <ArrowRight className="size-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 text-primary" />
      </div>
    </Link>
  );
}

/** Type a target once, then launch any compatible tool with it. */
function QuickTarget() {
  const sessionTarget = useSessionTarget();
  const [target, setTarget] = useState(sessionTarget ?? '');
  const value = target.trim();
  const tools = value ? toolsAccepting(value) : [];
  const pinned = !!value && value === sessionTarget;

  return (
    <Panel title="Quick target" tone="magenta">
      <div className="flex items-center border border-input bg-background/60 focus-within:border-neon-magenta">
        <span className="pl-3 text-sm text-neon-magenta" aria-hidden>
          ❯
        </span>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="example.com, 1.1.1.1 or https://…"
          aria-label="Quick target"
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/50"
        />
        {value && (
          <button
            type="button"
            onClick={() => setSessionTarget(pinned ? null : value)}
            aria-pressed={pinned}
            className={cn(
              'flex h-10 shrink-0 items-center gap-1.5 px-3 text-[11px] tracking-[0.15em] uppercase whitespace-nowrap transition-colors hover:text-neon-magenta',
              pinned ? 'text-neon-magenta' : 'text-muted-foreground',
            )}
            title="Tool pages prefill the session target"
          >
            {pinned ? (
              <Pin className="size-3.5 fill-current" aria-hidden />
            ) : (
              <PinOff className="size-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">
              {pinned ? 'Session target' : 'Pin for session'}
            </span>
            <span className="sm:hidden">{pinned ? 'Pinned' : 'Pin'}</span>
          </button>
        )}
      </div>
      <div className="mt-3 flex min-h-8 flex-wrap gap-2">
        {value ? (
          tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                to={tool.path}
                search={{ target: value }}
                className={cn(
                  'inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] tracking-[0.15em] uppercase transition hover:bg-card',
                  toneBorder[tool.tone],
                  toneText[tool.tone],
                )}
              >
                <Icon className="size-3.5" />
                {tool.name}
              </Link>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground">
            Enter a target to see which modules can run against it.
          </p>
        )}
      </div>
    </Panel>
  );
}
