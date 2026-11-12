import { queryOptions } from '@tanstack/react-query';
import {
  WIFI_INTERFACES_ENDPOINT,
  type WifiInterfacesOutput,
} from '@recon/shared';
import { apiFetch, type ApiError } from '@/lib/api-client';

export const wifiInterfacesQuery = queryOptions<WifiInterfacesOutput, ApiError>(
  {
    queryKey: ['wifi', 'interfaces'],
    queryFn: () => apiFetch(WIFI_INTERFACES_ENDPOINT),
    staleTime: 60_000,
    retry: false,
  },
);
