import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import {
  ENGAGEMENT_API,
  type EngagementFinding,
  type Note,
  type RunDiff,
  type RunPage,
  type ScopeEntry,
} from '@recon/shared';
import { apiFetch } from '@/lib/api-client';
import { ENGAGEMENTS_KEY, RUNS_KEY } from '@/lib/engagement';

export function scopeQuery(id: string) {
  return queryOptions({
    queryKey: [...ENGAGEMENTS_KEY, id, 'scope'],
    queryFn: () => apiFetch<ScopeEntry[]>(ENGAGEMENT_API.scope(id)),
  });
}

export interface RunFilters {
  tool?: string;
  target?: string;
  tag?: string;
  limit: number;
  offset: number;
}

export function runsQuery(id: string, filters: RunFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return queryOptions({
    queryKey: [...ENGAGEMENTS_KEY, id, 'runs', filters],
    queryFn: () =>
      apiFetch<RunPage>(`${ENGAGEMENT_API.runs(id)}?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
}

export function findingsQuery(id: string) {
  return queryOptions({
    queryKey: [...ENGAGEMENTS_KEY, id, 'findings'],
    queryFn: () => apiFetch<EngagementFinding[]>(ENGAGEMENT_API.findings(id)),
  });
}

export function notesQuery(id: string) {
  return queryOptions({
    queryKey: [...ENGAGEMENTS_KEY, id, 'notes'],
    queryFn: () => apiFetch<Note[]>(ENGAGEMENT_API.notes(id)),
  });
}

export function runDiffQuery(before: string, after: string) {
  return queryOptions({
    queryKey: [...RUNS_KEY, 'diff', before, after],
    queryFn: () => apiFetch<RunDiff>(ENGAGEMENT_API.runDiff(before, after)),
    retry: false,
  });
}
