import { queryOptions, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { ENGAGEMENT_API, type Engagement, type RunDetail } from '@recon/shared';
import { ApiError, apiFetch } from './api-client';
import {
  getActiveEngagementId,
  setActiveEngagementId,
  subscribeActiveEngagement,
} from './engagement-store';

export { getActiveEngagementId, setActiveEngagementId };

/** Query keys of the engagement workspace. Invalidate `ENGAGEMENTS_KEY` to refresh everything. */
export const ENGAGEMENTS_KEY = ['engagements'] as const;
export const RUNS_KEY = ['runs'] as const;

export const engagementsQuery = queryOptions({
  queryKey: ENGAGEMENTS_KEY,
  queryFn: () => apiFetch<Engagement[]>(ENGAGEMENT_API.list),
});

export function engagementQuery(id: string) {
  return queryOptions({
    queryKey: [...ENGAGEMENTS_KEY, id],
    queryFn: () => apiFetch<Engagement>(ENGAGEMENT_API.one(id)),
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}

export function runQuery(runId: string) {
  return queryOptions({
    queryKey: [...RUNS_KEY, runId],
    queryFn: () => apiFetch<RunDetail>(ENGAGEMENT_API.run(runId)),
    retry: false,
    staleTime: Infinity,
  });
}

/** The engagement new tool runs are recorded to (or none), persisted in localStorage. */
export function useActiveEngagement() {
  const id = useSyncExternalStore(
    subscribeActiveEngagement,
    getActiveEngagementId,
    () => null,
  );
  const setId = useCallback(
    (next: string | null) => setActiveEngagementId(next),
    [],
  );
  const engagement = useQuery({
    ...engagementQuery(id ?? ''),
    enabled: !!id,
  });

  // The stored id points to a deleted engagement: forget it.
  const notFound =
    engagement.error instanceof ApiError && engagement.error.status === 404;
  useEffect(() => {
    if (notFound) setActiveEngagementId(null);
  }, [notFound]);

  return {
    id,
    setId,
    engagement: id && !notFound ? engagement.data : undefined,
    query: engagement,
  };
}
