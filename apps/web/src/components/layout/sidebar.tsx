import { Link } from '@tanstack/react-router';
import { Activity, FolderKanban, LayoutGrid, ListChecks } from 'lucide-react';
import { CATEGORY_LABELS, type ToolCategory } from '@recon/shared';
import { LastRunDot, RuntimeBadge } from '@/components/tool';
import { TOOLS } from '@/features/registry';
import { cn } from '@/lib/utils';
import { toneText } from '@/lib/tones';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ToolCategory[];

const linkBase =
  'group flex items-center gap-3 border-l-2 border-transparent px-4 py-2 text-xs tracking-[0.15em] text-muted-foreground uppercase transition-colors hover:bg-sidebar-accent hover:text-foreground';
const linkActive = 'border-primary bg-sidebar-accent text-primary text-glow';

export function Sidebar() {
  return (
    <nav aria-label="Tools" className="space-y-6 py-4">
      <div className="space-y-1">
        <Link
          to="/"
          className={linkBase}
          activeProps={{ className: linkActive }}
          activeOptions={{ exact: true }}
        >
          <LayoutGrid className="size-4" />
          Dashboard
        </Link>
        <Link
          to="/batch"
          className={linkBase}
          activeProps={{ className: linkActive }}
        >
          <ListChecks className="size-4" />
          Batch
        </Link>
        <Link
          to="/engagements"
          className={linkBase}
          activeProps={{ className: linkActive }}
        >
          <FolderKanban className="size-4" />
          Engagements
        </Link>
        <Link
          to="/system"
          className={linkBase}
          activeProps={{ className: linkActive }}
        >
          <Activity className="size-4" />
          System
        </Link>
      </div>
      {CATEGORIES.map((cat) => {
        const tools = TOOLS.filter((t) => t.category === cat);
        if (!tools.length) return null;
        return (
          <div key={cat} className="space-y-1">
            <p className="px-4 text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">
              {'//'} {CATEGORY_LABELS[cat]}
            </p>
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.id}
                  to={tool.path}
                  className={linkBase}
                  activeProps={{ className: linkActive }}
                >
                  <Icon
                    data-accent
                    className={cn('size-4 shrink-0', toneText[tool.tone])}
                  />
                  <span className="truncate">{tool.name}</span>
                  <LastRunDot toolId={tool.id} />
                  <RuntimeBadge
                    toolId={tool.id}
                    compact
                    className="ml-auto shrink-0"
                  />
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/** Horizontal tool strip for small screens. */
export function MobileNav() {
  return (
    <nav
      aria-label="Tools"
      className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 md:hidden"
    >
      <Link
        to="/"
        className="shrink-0 border border-border px-2 py-1 text-[11px] tracking-wider uppercase"
        activeProps={{ className: 'border-primary text-primary' }}
        activeOptions={{ exact: true }}
      >
        Home
      </Link>
      <Link
        to="/batch"
        className="shrink-0 border border-border px-2 py-1 text-[11px] tracking-wider uppercase"
        activeProps={{ className: 'border-primary text-primary' }}
      >
        Batch
      </Link>
      <Link
        to="/engagements"
        className="shrink-0 border border-border px-2 py-1 text-[11px] tracking-wider uppercase"
        activeProps={{ className: 'border-primary text-primary' }}
      >
        Engagements
      </Link>
      <Link
        to="/system"
        className="shrink-0 border border-border px-2 py-1 text-[11px] tracking-wider uppercase"
        activeProps={{ className: 'border-primary text-primary' }}
      >
        System
      </Link>
      {TOOLS.map((tool) => (
        <Link
          key={tool.id}
          to={tool.path}
          className="shrink-0 border border-border px-2 py-1 text-[11px] tracking-wider whitespace-nowrap uppercase"
          activeProps={{ className: 'border-primary text-primary' }}
        >
          {tool.name}
        </Link>
      ))}
    </nav>
  );
}
