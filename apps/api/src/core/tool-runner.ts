import type { Finding, ToolId, ToolResult } from '@recon/shared';

export interface RunToolOptions<T> {
  /**
   * Extracts graded findings from the tool output. They are added to the envelope so
   * engagement history and the findings export can use them without knowing each tool.
   * Only include actionable results (pass/warn/fail); `info` is fine for context.
   */
  findings?: (data: T) => Finding[];
}

/** Wraps a tool execution in the standard ToolResult envelope. */
export async function runTool<T>(
  tool: ToolId,
  target: string,
  fn: () => Promise<T>,
  opts: RunToolOptions<T> = {},
): Promise<ToolResult<T>> {
  const startedAt = new Date();
  const t0 = performance.now();
  const data = await fn();
  const result: ToolResult<T> = {
    tool,
    target,
    startedAt: startedAt.toISOString(),
    durationMs: Math.round(performance.now() - t0),
    data,
  };
  const findings = opts.findings?.(data);
  if (findings?.length) result.findings = findings;
  return result;
}
