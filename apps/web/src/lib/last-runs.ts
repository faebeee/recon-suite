import {
  queryOptions,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import {
  LAST_RUNS_ENDPOINT,
  type LastRunSummary,
  type LastRunsSummaryResponse,
  type ToolId,
} from '@recon/shared';
import { apiFetch } from './api-client';

const POLL_WHILE_RUNNING_MS = 5_000;

/** Every tool's last run (no payloads); polls while one is still running. */
export const lastRunsQuery = queryOptions({
  queryKey: ['last-runs'],
  queryFn: () => apiFetch<LastRunsSummaryResponse>(LAST_RUNS_ENDPOINT),
  staleTime: 30_000,
  retry: false,
  refetchInterval: (q) =>
    q.state.data?.runs.some((r) => r.status === 'running')
      ? POLL_WHILE_RUNNING_MS
      : false,
});

/** The tool's last run summary, or undefined (none, or not loaded yet). */
export function useLastRunSummary(tool: ToolId): LastRunSummary | undefined {
  return useQuery({
    ...lastRunsQuery,
    select: (d) => d.runs.find((r) => r.tool === tool),
  }).data;
}

/** Shows a run as started right away; the poll then picks up the stored state. */
export function markRunStarted(qc: QueryClient, tool: ToolId, target: string) {
  qc.setQueryData<LastRunsSummaryResponse>(lastRunsQuery.queryKey, (prev) => ({
    runs: [
      ...(prev?.runs ?? []).filter((r) => r.tool !== tool),
      { tool, target, status: 'running', startedAt: new Date().toISOString() },
    ],
  }));
}
