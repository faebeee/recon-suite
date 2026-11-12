import { queryOptions } from '@tanstack/react-query';
import type { HealthResponse } from '@recon/shared';
import { apiFetch } from '@/lib/api-client';

export const healthQuery = queryOptions({
  queryKey: ['health'],
  queryFn: () => apiFetch<HealthResponse>('/health'),
  refetchInterval: 15_000,
  retry: false,
});
