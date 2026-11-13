import type { ReactNode } from 'react';

/** Centered, sidebar-less frame for the login and lock screens. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-grid px-4 py-10">
      <p className="flex items-center gap-2 font-display text-sm font-bold tracking-[0.25em] uppercase">
        <span className="text-neon-magenta text-glow">[</span>
        <span className="text-primary text-glow">Recon</span>
        <span className="text-muted-foreground">{'//'}</span>
        <span>Suite</span>
        <span className="text-neon-magenta text-glow">]</span>
      </p>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
