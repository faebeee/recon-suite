import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { ZoneTransferResults } from './zone-transfer-results';

export function ZoneTransferTool({
  initialTarget,
}: {
  initialTarget?: string;
}) {
  const runner = useToolRunner('zone-transfer', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="zone-transfer">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['zone-transfer'].targetHint}
        error={runner.validationError}
        label="Domain"
      />
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Requesting AXFR from nameservers"
      >
        {(data) => <ZoneTransferResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
