import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { DevFootprintResults } from './dev-footprint-results';

export function DevFootprintTool({
  initialTarget,
}: {
  initialTarget?: string;
}) {
  const runner = useToolRunner('dev-footprint', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="dev-footprint">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['dev-footprint'].targetHint}
        error={runner.validationError}
        label="Organisation handle or domain"
      />
      <ToolResultView mutation={runner.mutation} loadingLabel="Searching">
        {(data) => <DevFootprintResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
