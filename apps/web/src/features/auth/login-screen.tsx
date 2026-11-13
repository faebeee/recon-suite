import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogIn } from 'lucide-react';
import { useId, useState } from 'react';
import { AUTH_ENDPOINTS, loginInputSchema } from '@recon/shared';
import { Panel } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost, type ApiError } from '@/lib/api-client';
import { AUTH_STATUS_KEY } from '@/lib/query-client';
import { AuthLayout } from './auth-layout';

export function LoginScreen() {
  const id = useId();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [validation, setValidation] = useState<string | null>(null);

  const login = useMutation<unknown, ApiError, string>({
    mutationFn: (pw) => apiPost(AUTH_ENDPOINTS.login, { password: pw }),
    onSuccess: async () => {
      setPassword('');
      await queryClient.invalidateQueries({ queryKey: AUTH_STATUS_KEY });
      // Data fetched while signed out failed with 401: reload it.
      void queryClient.invalidateQueries();
    },
  });

  const error = validation ?? login.error?.message ?? null;

  return (
    <AuthLayout>
      <Panel title="Sign in" bodyClassName="space-y-4">
        <p className="text-xs text-muted-foreground">
          This Recon Suite API is protected. Enter the admin password to
          continue.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = loginInputSchema.safeParse({ password });
            if (!parsed.success) {
              setValidation(parsed.error.issues[0]?.message ?? 'Invalid');
              return;
            }
            setValidation(null);
            login.mutate(parsed.data.password);
          }}
        >
          <div className="space-y-1.5">
            <label
              htmlFor={id}
              className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
            >
              Password
            </label>
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            {error && (
              <p
                id={`${id}-error`}
                role="alert"
                className="text-xs text-neon-magenta"
              >
                ! {error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={login.isPending} className="w-full">
            {login.isPending ? <Loader2 className="animate-spin" /> : <LogIn />}
            {login.isPending ? 'Signing in' : 'Sign in'}
          </Button>
        </form>
      </Panel>
    </AuthLayout>
  );
}
