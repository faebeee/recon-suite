import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { ReverseIpResults } from './reverse-ip-results';
import { ReverseIpRadar } from './reverse-ip-radar';

export function ReverseIpTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('reverse-ip', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="reverse-ip">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['reverse-ip'].targetHint}
        error={runner.validationError}
        label="IP or domain"
      />
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Asking SecurityTrails"
      >
        {(data) => (
          <>
            <ReverseIpRadar data={data} />
            <ReverseIpResults data={data} />
          </>
        )}
      </ToolResultView>
    </ToolPage>
  );
}
