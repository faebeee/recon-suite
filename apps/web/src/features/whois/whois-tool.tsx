import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { WhoisResults } from './whois-results';
import { whoisIntelView } from './whois-intel-view';

export function WhoisTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('whois', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="whois">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.whois.targetHint}
        error={runner.validationError}
        label="Domain or IP"
      />
      <ToolResultView
        intelView={whoisIntelView}
        mutation={runner.mutation}
        loadingLabel="Querying registry"
      >
        {(data) => <WhoisResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
