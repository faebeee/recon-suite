import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { ApiDiscoveryResults } from './api-discovery-results';

export function ApiDiscoveryTool({
  initialTarget,
}: {
  initialTarget?: string;
}) {
  const runner = useToolRunner('api-discovery', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="api-discovery">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['api-discovery'].targetHint}
        error={runner.validationError}
        label="URL"
      />
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Probing API locations"
      >
        {(data) => <ApiDiscoveryResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
