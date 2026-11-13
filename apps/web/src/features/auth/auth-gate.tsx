import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { authStatusQuery } from '@/lib/auth';
import { LoginScreen } from './login-screen';
import { OpenModeScreen } from './open-mode-screen';

/**
 * Renders the app only when the API accepts our requests. If the status call itself
 * fails (API down, older API), the app still renders so the uplink indicator can explain.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useQuery(authStatusQuery);

  if (auth.isPending) {
    return (
      <div
        className="flex min-h-screen items-center justify-center gap-3 bg-grid text-[11px] tracking-[0.3em] text-muted-foreground uppercase"
        role="status"
      >
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
        Linking
      </div>
    );
  }

  if (auth.data && !auth.data.authenticated) {
    return auth.data.mode === 'password' ? <LoginScreen /> : <OpenModeScreen />;
  }

  return <>{children}</>;
}
