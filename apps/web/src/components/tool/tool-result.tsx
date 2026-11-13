import { History, RotateCw, Terminal, XOctagon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ToolResult } from '@recon/shared';
import { CopyButton, Panel, TerminalLoader } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ApiError } from '@/lib/api-client';
import type { SavedRunInfo } from '@/lib/use-tool-runner';
import { formatDateTime, formatMs } from '@/lib/format';

/** The subset of a TanStack mutation this view needs. */
interface RunState<T> {
  isPending: boolean;
  error: ApiError | null;
  data: ToolResult<T> | undefined;
  /** Set when the result was loaded from an engagement's history (?run=). */
  saved?: SavedRunInfo;
}

interface ToolResultViewProps<T> {
  mutation: RunState<T>;
  loadingLabel?: string;
  children: (data: T, result: ToolResult<T>) => ReactNode;
}

/**
 * Renders the lifecycle of a tool run: idle hint, scanning animation, error,
 * or results with a meta bar and a RAW JSON tab.
 */
export function ToolResultView<T>(props: ToolResultViewProps<T>) {
  const saved = props.mutation.saved;
  if (!saved) return <ResultLifecycle {...props} />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-primary/40 px-3 py-2 text-xs">
        <span className="flex items-center gap-2 text-muted-foreground">
          <History className="size-3.5 text-primary" aria-hidden />
          Saved run from{' '}
          <span className="text-foreground">
            {formatDateTime(saved.startedAt)}
          </span>
        </span>
        <Button size="sm" variant="outline" onClick={saved.runAgain}>
          <RotateCw />
          Run again
        </Button>
      </div>
      <ResultLifecycle {...props} />
    </div>
  );
}

function ResultLifecycle<T>({
  mutation,
  loadingLabel = 'Scanning',
  children,
}: ToolResultViewProps<T>) {
  if (mutation.isPending) {
    return (
      <Panel title="Output">
        <TerminalLoader label={loadingLabel} />
      </Panel>
    );
  }

  if (mutation.error) {
    const err = mutation.error;
    return (
      <Panel title="Error" tone="magenta">
        <div className="flex items-start gap-3 text-sm">
          <XOctagon className="mt-0.5 size-5 shrink-0 text-neon-magenta" />
          <div className="space-y-1">
            <p className="font-display text-xs tracking-[0.2em] text-neon-magenta uppercase">
              {err.status ? `Error ${err.status}` : 'Connection failure'}
            </p>
            {(err.messages?.length ? err.messages : [err.message]).map((m) => (
              <p key={m} className="text-muted-foreground">
                {m}
              </p>
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  if (!mutation.data) {
    return (
      <div className="flex items-center gap-3 border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
        <Terminal className="size-4 text-primary" />
        Awaiting target. Enter one above and press Execute.
        <span className="animate-blink text-primary">_</span>
      </div>
    );
  }

  const result = mutation.data;
  return (
    <Tabs defaultValue="result" className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tracking-wider text-muted-foreground uppercase">
          <span>
            target{' '}
            <span className="text-primary normal-case">{result.target}</span>
          </span>
          <span>
            time{' '}
            <span className="text-foreground">
              {formatMs(result.durationMs)}
            </span>
          </span>
          <span>
            at{' '}
            <span className="text-foreground">
              {formatDateTime(result.startedAt)}
            </span>
          </span>
        </div>
        <TabsList>
          <TabsTrigger value="result">Result</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="result" className="space-y-4">
        {children(result.data, result)}
      </TabsContent>
      <TabsContent value="raw">
        <Panel
          title="Raw JSON"
          actions={<CopyButton value={JSON.stringify(result, null, 2)} />}
        >
          <pre className="max-h-[60vh] overflow-auto text-xs leading-relaxed text-neon-green/90">
            {JSON.stringify(result, null, 2)}
          </pre>
        </Panel>
      </TabsContent>
    </Tabs>
  );
}
