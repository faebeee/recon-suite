import { queryOptions } from '@tanstack/react-query';
import {
  HOST_SCAN_INTERFACES_ENDPOINT,
  type HostScanInterfacesOutput,
} from '@recon/shared';
import { apiFetch, type ApiError } from '@/lib/api-client';

export const hostScanInterfacesQuery = queryOptions<
  HostScanInterfacesOutput,
  ApiError
>({
  queryKey: ['host-scan', 'interfaces'],
  queryFn: () => apiFetch(HOST_SCAN_INTERFACES_ENDPOINT),
  staleTime: 60_000,
  retry: false,
});
