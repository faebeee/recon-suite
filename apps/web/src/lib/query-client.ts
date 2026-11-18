import { QueryClient } from '@tanstack/react-query';

/** The app-wide query client (shared by the router context and the API client). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000 },
  },
});
