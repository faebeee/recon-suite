import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { DnsblResults } from './dnsbl-results';

export function DnsblTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('dnsbl', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="dnsbl">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.dnsbl.targetHint}
        error={runner.validationError}
        label="Domain or IPv4"
      />
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Querying blocklists"
      >
        {(data) => <DnsblResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
