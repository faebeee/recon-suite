import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { CorsResults } from './cors-results';

export function CorsTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('cors', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="cors">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.cors.targetHint}
        error={runner.validationError}
        label="URL"
      />
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Sending CORS probes"
      >
        {(data) => <CorsResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
