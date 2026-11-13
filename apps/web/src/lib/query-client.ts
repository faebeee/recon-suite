import { QueryClient } from '@tanstack/react-query';

/** The app-wide query client (shared by the router context and the API client). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000 },
  },
});

/** Query key of `GET /auth/status`; invalidated on any 401 to show the login screen. */
export const AUTH_STATUS_KEY = ['auth', 'status'] as const;
