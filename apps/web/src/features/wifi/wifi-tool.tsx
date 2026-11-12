import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useId, useState } from 'react';
import { Panel } from '@/components/cyber';
import { ToolPage, ToolResultView } from '@/components/tool';
import { Button } from '@/components/ui/button';
import { useToolRunner } from '@/lib/use-tool-runner';
import { InterfaceSelect } from './interface-select';
import { wifiInterfacesQuery } from './interfaces-query';
import { WifiResults } from './wifi-results';

export function WifiTool() {
  const selectId = useId();
  const interfaces = useQuery(wifiInterfacesQuery);
  const [picked, setPicked] = useState<string>();
  // Until the user picks one, follow the server's default (connected or first interface).
  const selected = picked ?? interfaces.data?.defaultInterface;

  const runner = useToolRunner('wifi', {
    buildInput: () => ({ interface: selected }),
  });
  const { isPending, data } = runner.mutation;
  const noInterfaces =
    interfaces.isSuccess && interfaces.data.interfaces.length === 0;

  return (
    <ToolPage toolId="wifi">
      <Panel title="Scan" bodyClassName="space-y-3">
        <p className="text-xs text-muted-foreground">
          Lists the networks the API host's wireless adapter can see. Requires
          the API to run natively (e.g.{' '}
          <code className="text-foreground">pnpm dev</code>); containers have no
          WiFi adapter.
        </p>
        <div className="space-y-1.5">
          <label
            htmlFor={selectId}
            className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
          >
            Interface
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <InterfaceSelect
              id={selectId}
              interfaces={interfaces.data?.interfaces ?? []}
              value={selected}
              onChange={setPicked}
              disabled={interfaces.isPending}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="hidden sm:inline-flex"
              onClick={() => interfaces.refetch()}
              disabled={interfaces.isFetching}
              aria-label="Reload interfaces"
              title="Reload interfaces"
            >
              <RefreshCw
                className={interfaces.isFetching ? 'animate-spin' : undefined}
              />
            </Button>
            <Button
              onClick={() => runner.run()}
              disabled={isPending || !selected}
              className="h-10 shrink-0 px-5 sm:ml-auto"
            >
              {isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {isPending ? 'Scanning' : data ? 'Rescan' : 'Scan'}
            </Button>
          </div>
          {interfaces.isError && (
            <p className="flex items-start gap-2 text-xs text-neon-magenta">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {interfaces.error.message}
            </p>
          )}
          {noInterfaces && (
            <p className="text-xs text-neon-yellow">
              No WiFi interface found on the API host.
            </p>
          )}
        </div>
      </Panel>
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel={`Sweeping the airwaves on ${selected ?? '…'}`}
      >
        {(output) => <WifiResults data={output} />}
      </ToolResultView>
    </ToolPage>
  );
}
