import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut } from 'lucide-react';
import { AUTH_ENDPOINTS } from '@recon/shared';
import { Button } from '@/components/ui/button';
import { apiPost } from '@/lib/api-client';
import { authStatusQuery } from '@/lib/auth';
import { AUTH_STATUS_KEY } from '@/lib/query-client';

/** Shown only when a password is configured and the user is signed in. */
export function LogoutButton() {
  const queryClient = useQueryClient();
  const auth = useQuery(authStatusQuery);
  const logout = useMutation({
    mutationFn: () => apiPost(AUTH_ENDPOINTS.logout, {}),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: AUTH_STATUS_KEY });
      queryClient.removeQueries({
        predicate: (q) =>
          q.queryKey[0] === 'engagements' || q.queryKey[0] === 'runs',
      });
    },
  });

  if (auth.data?.mode !== 'password' || !auth.data.authenticated) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      aria-label="Sign out"
      title="Sign out"
      className="size-7"
    >
      {logout.isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
    </Button>
  );
}
