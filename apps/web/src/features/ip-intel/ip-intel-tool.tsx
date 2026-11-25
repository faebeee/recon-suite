import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { IpIntelResults } from './ip-intel-results';
import { ipIntelIntelView } from './ip-intel-intel-view';

export function IpIntelTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('ip-intel', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="ip-intel">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['ip-intel'].targetHint}
        error={runner.validationError}
        label="IP or domain"
      />
      <ToolResultView
        intelView={ipIntelIntelView}
        mutation={runner.mutation}
        loadingLabel="Looking up"
      >
        {(data) => <IpIntelResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
