import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { WebFilesResults } from './web-files-results';

export function WebFilesTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('web-files', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="web-files">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['web-files'].targetHint}
        error={runner.validationError}
        label="Origin"
      />
      <ToolResultView mutation={runner.mutation} loadingLabel="Fetching files">
        {(data) => <WebFilesResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
