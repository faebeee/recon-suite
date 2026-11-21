import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiStatus } from '@/features/system';
import { EngagementSwitcher } from './engagement-switcher';
import { SessionTargetControl } from './session-target-control';
import { ThemeSwitcher } from './theme-switcher';

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <time className="tabular-nums">{now.toISOString().slice(11, 19)} UTC</time>
  );
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. */
const SHORTCUT =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? '⌘K'
    : 'Ctrl K';

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header
      data-slot="top-bar"
      className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur"
    >
      <Link
        to="/"
        data-slot="brand"
        className="flex shrink-0 items-center gap-2 font-display text-sm font-bold tracking-[0.25em] uppercase"
      >
        <span data-accent className="text-neon-magenta text-glow">
          [
        </span>
        <span className="text-primary text-glow animate-flicker">Recon</span>
        <span className="hidden text-muted-foreground sm:inline">{'//'}</span>
        <span className="hidden sm:inline">Suite</span>
        <span data-accent className="text-neon-magenta text-glow">
          ]
        </span>
      </Link>
      <button
        type="button"
        onClick={onOpenPalette}
        aria-label={`Search tools and pages (${SHORTCUT})`}
        aria-keyshortcuts="Meta+K Control+K"
        className="flex min-w-0 items-center gap-2 border border-border px-2 py-1 text-[11px] tracking-[0.15em] text-muted-foreground uppercase transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden border border-border px-1 text-[10px] sm:inline">
          {SHORTCUT}
        </kbd>
      </button>
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
        <span className="hidden text-neon-yellow/80 lg:inline">
          Authorised use only
        </span>
        <span className="hidden sm:inline">
          <Clock />
        </span>
        <ApiStatus />
        <SessionTargetControl />
        <EngagementSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
