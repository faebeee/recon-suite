import { queryOptions } from '@tanstack/react-query';
import { AUTH_ENDPOINTS, type AuthStatus } from '@recon/shared';
import { apiFetch } from './api-client';
import { AUTH_STATUS_KEY } from './query-client';

export const authStatusQuery = queryOptions({
  queryKey: AUTH_STATUS_KEY,
  queryFn: () => apiFetch<AuthStatus>(AUTH_ENDPOINTS.status),
  retry: 1,
});
