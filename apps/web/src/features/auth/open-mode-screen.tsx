import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { Panel } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { AUTH_STATUS_KEY } from '@/lib/query-client';
import { AuthLayout } from './auth-layout';

/** No password is configured and this browser is not on the API's machine. */
export function OpenModeScreen() {
  const queryClient = useQueryClient();
  return (
    <AuthLayout>
      <Panel
        title="Remote access locked"
        tone="yellow"
        bodyClassName="space-y-3"
      >
        <p className="flex items-start gap-2 text-sm">
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-neon-yellow"
            aria-hidden
          />
          No admin password is configured, so the API only accepts
          unauthenticated requests from its own machine.
        </p>
        <p className="text-xs text-muted-foreground">
          To use Recon Suite remotely, set{' '}
          <code className="text-foreground">ADMIN_PASSWORD</code> (or{' '}
          <code className="text-foreground">ADMIN_PASSWORD_HASH</code>) in the
          API's environment and restart it. You can then sign in here.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void queryClient.invalidateQueries({ queryKey: AUTH_STATUS_KEY })
          }
        >
          <RefreshCw />
          Check again
        </Button>
      </Panel>
    </AuthLayout>
  );
}
