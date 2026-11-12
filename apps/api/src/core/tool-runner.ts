import type { ToolId, ToolResult } from '@recon/shared';

/** Wraps a tool execution in the standard ToolResult envelope. */
export async function runTool<T>(
  tool: ToolId,
  target: string,
  fn: () => Promise<T>,
): Promise<ToolResult<T>> {
  const startedAt = new Date();
  const t0 = performance.now();
  const data = await fn();
  return {
    tool,
    target,
    startedAt: startedAt.toISOString(),
    durationMs: Math.round(performance.now() - t0),
    data,
  };
}
