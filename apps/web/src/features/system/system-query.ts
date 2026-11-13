import { queryOptions } from '@tanstack/react-query';
import { SYSTEM_OVERVIEW_ENDPOINT, type SystemOverview } from '@recon/shared';
import { apiFetch } from '@/lib/api-client';

/** Settings and live status checks; refreshed while the system page is open. */
export const systemOverviewQuery = queryOptions({
  queryKey: ['system', 'overview'],
  queryFn: () => apiFetch<SystemOverview>(SYSTEM_OVERVIEW_ENDPOINT),
  refetchInterval: 30_000,
  retry: false,
});
