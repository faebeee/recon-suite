import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LogoutButton } from '@/features/auth';
import { ApiStatus } from '@/features/system';
import { EngagementSwitcher } from './engagement-switcher';
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

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-2 font-display text-sm font-bold tracking-[0.25em] uppercase"
      >
        <span className="text-neon-magenta text-glow">[</span>
        <span className="text-primary text-glow animate-flicker">Recon</span>
        <span className="hidden text-muted-foreground sm:inline">{'//'}</span>
        <span className="hidden sm:inline">Suite</span>
        <span className="text-neon-magenta text-glow">]</span>
      </Link>
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
        <span className="hidden text-neon-yellow/80 lg:inline">
          Authorised use only
        </span>
        <span className="hidden sm:inline">
          <Clock />
        </span>
        <ApiStatus />
        <EngagementSwitcher />
        <ThemeSwitcher />
        <LogoutButton />
      </div>
    </header>
  );
}
