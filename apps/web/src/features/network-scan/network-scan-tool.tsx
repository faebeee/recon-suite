import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { NetworkScanResults } from './network-scan-results';
import { NetworkScanRadar, networkScanDiscovery } from './network-scan-radar';

export function NetworkScanTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('network-scan', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="network-scan">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['network-scan'].targetHint}
        error={runner.validationError}
        label="Network / IP / Subnet"
      />
      <ToolResultView
        intelView={(d) => networkScanDiscovery(d)}
        mutation={runner.mutation}
        loadingLabel="Sweeping the network"
      >
        {(data) => (
          <>
            <NetworkScanRadar data={data} />
            <NetworkScanResults data={data} />
          </>
        )}
      </ToolResultView>
    </ToolPage>
  );
}
