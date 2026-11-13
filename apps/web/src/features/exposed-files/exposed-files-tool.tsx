import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { ExposedFilesResults } from './exposed-files-results';

export function ExposedFilesTool({
  initialTarget,
}: {
  initialTarget?: string;
}) {
  const runner = useToolRunner('exposed-files', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="exposed-files">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['exposed-files'].targetHint}
        error={runner.validationError}
        label="Origin"
      />
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Checking well-known paths"
      >
        {(data) => <ExposedFilesResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
