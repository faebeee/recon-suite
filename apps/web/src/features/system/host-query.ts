import { queryOptions } from '@tanstack/react-query';
import { SYSTEM_HOST_ENDPOINT, type HostStats } from '@recon/shared';
import { apiFetch } from '@/lib/api-client';

/** Host facts and the internet check (the API caches the check for 30 s). */
export const hostStatsQuery = queryOptions({
  queryKey: ['system', 'host'],
  queryFn: () => apiFetch<HostStats>(SYSTEM_HOST_ENDPOINT),
  refetchInterval: 30_000,
  retry: false,
});
