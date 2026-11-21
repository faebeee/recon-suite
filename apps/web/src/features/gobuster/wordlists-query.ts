import { queryOptions } from '@tanstack/react-query';
import {
  GOBUSTER_WORDLISTS_ENDPOINT,
  type GobusterWordlistsOutput,
} from '@recon/shared';
import { apiFetch, type ApiError } from '@/lib/api-client';

/** Wordlists installed on the API host (plus the built-in ones). */
export const gobusterWordlistsQuery = queryOptions<
  GobusterWordlistsOutput,
  ApiError
>({
  queryKey: ['gobuster', 'wordlists'],
  queryFn: () => apiFetch(GOBUSTER_WORDLISTS_ENDPOINT),
  staleTime: 60_000,
  retry: false,
});
