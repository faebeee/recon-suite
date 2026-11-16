import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { PassiveExposureResults } from './passive-exposure-results';

export function PassiveExposureTool({
  initialTarget,
}: {
  initialTarget?: string;
}) {
  const runner = useToolRunner('passive-exposure', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="passive-exposure">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['passive-exposure'].targetHint}
        error={runner.validationError}
        label="IP or domain"
      />
      <ToolResultView mutation={runner.mutation} loadingLabel="Querying">
        {(data) => <PassiveExposureResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
