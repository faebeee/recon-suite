import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { HttpMethodsResults } from './http-methods-results';

export function HttpMethodsTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('http-methods', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="http-methods">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['http-methods'].targetHint}
        error={runner.validationError}
        label="URL"
      />
      <ToolResultView mutation={runner.mutation} loadingLabel="Probing">
        {(data) => <HttpMethodsResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
