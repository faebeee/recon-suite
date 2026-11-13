import type { QueryClient } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { Panel } from '@/components/cyber';
import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/features/auth';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <AuthGate>
      <AppShell>
        <Outlet />
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'TanStack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              { name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> },
            ]}
          />
        )}
      </AppShell>
    </AuthGate>
  );
}

function NotFound() {
  return (
    <Panel title="404" tone="magenta">
      <p className="text-sm text-muted-foreground">
        Signal lost. This route does not exist.{' '}
        <Link
          to="/"
          className="text-primary underline-offset-4 hover:underline"
        >
          Return to dashboard
        </Link>
      </p>
    </Panel>
  );
}
