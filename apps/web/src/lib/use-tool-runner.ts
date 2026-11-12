import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  TOOL_INPUT_SCHEMAS,
  toolEndpoint,
  type ToolId,
  type ToolIO,
  type ToolResult,
} from '@recon/shared';
import { apiPost, type ApiError } from './api-client';

interface Options<Id extends ToolId> {
  initialTarget?: string;
  /** Builds the request body from the target plus the tool's current options. */
  buildInput: (target: string) => ToolIO[Id]['input'];
}

/**
 * Standard state machine for a tool page: target input, client-side validation
 * with the shared schema, the API mutation, and auto-run when opened with ?target=.
 */
export function useToolRunner<Id extends ToolId>(
  id: Id,
  { initialTarget, buildInput }: Options<Id>,
) {
  const [target, setTarget] = useState(initialTarget ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation<
    ToolResult<ToolIO[Id]['output']>,
    ApiError,
    ToolIO[Id]['input']
  >({
    mutationKey: ['tool', id],
    mutationFn: (input) => apiPost(toolEndpoint(id), input),
  });

  const run = (overrideTarget?: string) => {
    const input = buildInput(overrideTarget ?? target);
    const parsed = TOOL_INPUT_SCHEMAS[id].safeParse(input);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setValidationError(null);
    mutation.mutate(input);
  };

  // Auto-run once when the page is opened with a target (pivots from other tools).
  const autoRan = useRef(false);
  useEffect(() => {
    if (initialTarget && !autoRan.current) {
      autoRan.current = true;
      run(initialTarget);
    }
  }, [initialTarget]);

  return { target, setTarget, run, validationError, mutation };
}

export type ToolRunner<Id extends ToolId> = ReturnType<
  typeof useToolRunner<Id>
>;
