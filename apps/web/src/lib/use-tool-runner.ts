import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  lastRunEndpoint,
  TOOL_INPUT_SCHEMAS,
  toolEndpoint,
  type LastToolRun,
  type LastToolRunResponse,
  type ToolId,
  type ToolIO,
  type ToolResult,
} from '@recon/shared';
import { targetForTool } from '@/features/registry';
import { ApiError, apiFetch, apiPost } from './api-client';
import { ENGAGEMENTS_KEY, runQuery } from './engagement';
import { useSessionTarget } from './session-target';

interface Options<Id extends ToolId> {
  initialTarget?: string;
  /** Builds the request body from the target plus the tool's current options. */
  buildInput: (target: string) => ToolIO[Id]['input'];
}

/** Shown above a result that was loaded from an engagement's history or the last run. */
export interface SavedRunInfo {
  startedAt: string;
  runAgain: () => void;
}

/** What `ToolResultView` renders: a live mutation or a saved run. */
export interface RunView<T> {
  isPending: boolean;
  error: ApiError | null;
  data: ToolResult<T> | undefined;
  saved?: SavedRunInfo;
}

/** How often a page polls a run that is still in progress on the API. */
const RUNNING_POLL_MS = 2_000;

/**
 * The tool's most recent run, stored by the API (`tool_last_runs`). Polled while it is still
 * running, e.g. after leaving the page during a long nmap scan and coming back.
 */
export function lastRunQuery(id: ToolId) {
  return queryOptions({
    queryKey: ['last-run', id],
    queryFn: () => apiFetch<LastToolRunResponse>(lastRunEndpoint(id)),
    staleTime: 0,
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.run?.status === 'running' ? RUNNING_POLL_MS : false,
  });
}

/**
 * Standard state machine for a tool page: target input, client-side validation
 * with the shared schema, the API mutation, and auto-run when opened with ?target=.
 * When opened with ?run=<id>, the saved run is shown instead (no auto-run).
 *
 * Until the user starts a run on this page, it shows the tool's last run from the database
 * (with its target), so results survive navigation, reloads and browser changes.
 *
 * Target prefill, first match wins: `?target=` (pivots), the session target (adapted to what
 * the tool accepts), the last run's target. With a session target, a last run against another
 * target is not shown, so the page never mixes two targets.
 */
export function useToolRunner<Id extends ToolId>(
  id: Id,
  { initialTarget, buildInput }: Options<Id>,
) {
  type Output = ToolIO[Id]['output'];
  const queryClient = useQueryClient();
  const search: { run?: string } = useSearch({ strict: false });
  const runId = search.run;

  const sessionTarget = useSessionTarget();
  const sessionValue = sessionTarget
    ? targetForTool(id, sessionTarget)
    : undefined;

  const [target, setTargetState] = useState(
    initialTarget ?? sessionValue ?? '',
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  // Once the user edits the target, a late-loading last run must not overwrite it.
  const touched = useRef(!!(initialTarget ?? sessionValue));
  const setTarget = (value: string) => {
    touched.current = true;
    setTargetState(value);
  };

  // Whether the user started a run since the saved run was opened.
  const [started, setStarted] = useState(false);
  const [prevRunId, setPrevRunId] = useState(runId);
  if (runId !== prevRunId) {
    setPrevRunId(runId);
    setStarted(false);
  }
  const showSaved = !!runId && !started;

  const saved = useQuery({ ...runQuery(runId ?? ''), enabled: showSaved });
  const last = useQuery({ ...lastRunQuery(id), enabled: !runId });
  const lastTarget = targetOf(last.data?.run?.input);
  // The target this page is about; a last run against another one stays hidden.
  const focusTarget = initialTarget ?? sessionValue;
  const lastRun =
    focusTarget && lastTarget !== undefined && lastTarget !== focusTarget
      ? undefined
      : (last.data?.run ?? undefined);

  const mutation = useMutation<
    ToolResult<Output>,
    ApiError,
    ToolIO[Id]['input']
  >({
    mutationKey: ['tool', id],
    mutationFn: (input) => apiPost(toolEndpoint(id), input),
    onSuccess: (result) => {
      if (result.runId) {
        void queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
      }
    },
    // The API stored the outcome; refresh it for when the page is opened again.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: lastRunQuery(id).queryKey }),
  });

  const run = (overrideTarget?: string) => {
    const input = buildInput(overrideTarget ?? target);
    const parsed = TOOL_INPUT_SCHEMAS[id].safeParse(input);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setValidationError(null);
    setStarted(true);
    mutation.mutate(input);
  };

  // Auto-run once when the page is opened with a target (pivots from other tools), unless a
  // saved run is shown or the stored last run already used this target (e.g. the user came
  // back to the page: show that run instead of starting a new scan). Waits for the last run.
  const autoRan = useRef(false);
  const lastLoaded = !last.isPending;
  useEffect(() => {
    if (!initialTarget || runId || autoRan.current || !lastLoaded) return;
    autoRan.current = true;
    if (initialTarget !== lastTarget) run(initialTarget);
  }, [initialTarget, lastLoaded]);

  // A session target set or changed while this page is open replaces the form's target.
  const prevSession = useRef(sessionValue);
  useEffect(() => {
    if (sessionValue === prevSession.current) return;
    prevSession.current = sessionValue;
    if (sessionValue) {
      touched.current = true;
      setTargetState(sessionValue);
      setValidationError(null);
    }
  }, [sessionValue]);

  // Put the last run's target into the form (only if the user hasn't typed one).
  useEffect(() => {
    if (lastTarget && !touched.current && mutation.isIdle) {
      setTargetState(lastTarget);
    }
  }, [lastTarget]);

  // Put the saved run's target into the form.
  const savedRun = showSaved ? saved.data : undefined;
  useEffect(() => {
    if (savedRun && savedRun.tool === id) setTargetState(savedRun.target);
  }, [savedRun, id]);

  let view: RunView<Output>;
  if (showSaved) {
    let error: ApiError | null = null;
    if (saved.error) {
      error =
        saved.error instanceof ApiError
          ? saved.error
          : new ApiError(0, [saved.error.message]);
    } else if (savedRun && savedRun.tool !== id) {
      error = new ApiError(400, [
        `This saved run belongs to the ${savedRun.tool} tool.`,
      ]);
    } else if (savedRun?.error) {
      error = new ApiError(savedRun.error.status, [savedRun.error.message]);
    }
    view = {
      isPending: saved.isPending,
      error,
      data: error ? undefined : (savedRun?.result as ToolResult<Output>),
      saved: savedRun
        ? { startedAt: savedRun.startedAt, runAgain: () => run() }
        : undefined,
    };
  } else if (mutation.isIdle && lastRun) {
    view = lastRunView<Output>(lastRun, () => run());
  } else {
    view = {
      isPending: mutation.isPending,
      error: mutation.error,
      data: mutation.data,
    };
  }

  return { target, setTarget, run, validationError, mutation: view };
}

export type ToolRunner<Id extends ToolId> = ReturnType<
  typeof useToolRunner<Id>
>;

/** A stored last run as the result view shows it (running ones as a pending scan). */
function lastRunView<T>(r: LastToolRun, runAgain: () => void): RunView<T> {
  if (r.status === 'running') {
    return { isPending: true, error: null, data: undefined };
  }
  return {
    isPending: false,
    error: r.error ? new ApiError(r.error.status, [r.error.message]) : null,
    data: r.result as ToolResult<T> | undefined,
    saved: { startedAt: r.startedAt, runAgain },
  };
}

/** The `target` field of a tool input; local tools have none. */
function targetOf(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null || !('target' in input)) {
    return undefined;
  }
  return typeof input.target === 'string' ? input.target : undefined;
}
