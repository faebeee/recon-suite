import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  TOOL_INPUT_SCHEMAS,
  toolEndpoint,
  type ToolId,
  type ToolIO,
  type ToolResult,
} from '@recon/shared';
import { ApiError, apiPost } from './api-client';
import { ENGAGEMENTS_KEY, runQuery } from './engagement';

interface Options<Id extends ToolId> {
  initialTarget?: string;
  /** Builds the request body from the target plus the tool's current options. */
  buildInput: (target: string) => ToolIO[Id]['input'];
}

/** Shown above a result that was loaded from an engagement's history. */
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

/**
 * Standard state machine for a tool page: target input, client-side validation
 * with the shared schema, the API mutation, and auto-run when opened with ?target=.
 * When opened with ?run=<id>, the saved run is shown instead (no auto-run).
 */
export function useToolRunner<Id extends ToolId>(
  id: Id,
  { initialTarget, buildInput }: Options<Id>,
) {
  type Output = ToolIO[Id]['output'];
  const queryClient = useQueryClient();
  const search: { run?: string } = useSearch({ strict: false });
  const runId = search.run;

  const [target, setTarget] = useState(initialTarget ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Whether the user started a run since the saved run was opened.
  const [started, setStarted] = useState(false);
  const [prevRunId, setPrevRunId] = useState(runId);
  if (runId !== prevRunId) {
    setPrevRunId(runId);
    setStarted(false);
  }
  const showSaved = !!runId && !started;

  const saved = useQuery({ ...runQuery(runId ?? ''), enabled: showSaved });

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

  // Auto-run once when the page is opened with a target (pivots from other tools),
  // unless a saved run is being shown.
  const autoRan = useRef(false);
  useEffect(() => {
    if (initialTarget && !runId && !autoRan.current) {
      autoRan.current = true;
      run(initialTarget);
    }
  }, [initialTarget]);

  // Put the saved run's target into the form.
  const savedRun = showSaved ? saved.data : undefined;
  useEffect(() => {
    if (savedRun && savedRun.tool === id) setTarget(savedRun.target);
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
