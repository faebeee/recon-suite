import type { ReactNode } from 'react';
import { MobileNav, Sidebar } from './sidebar';
import { TopBar } from './top-bar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:p-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <TopBar />
      <MobileNav />
      <div className="flex">
        <aside
          data-slot="sidebar"
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar/60 md:block"
        >
          <Sidebar />
        </aside>
        <main id="main" data-slot="main" className="min-w-0 flex-1 bg-grid">
          <div data-slot="page" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
