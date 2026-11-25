import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { FaviconHashResults } from './favicon-hash-results';
import { faviconHashIntelView } from './favicon-hash-intel-view';

export function FaviconHashTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('favicon-hash', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="favicon-hash">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['favicon-hash'].targetHint}
        error={runner.validationError}
        label="URL"
      />
      <ToolResultView
        intelView={faviconHashIntelView}
        mutation={runner.mutation}
        loadingLabel="Hashing icons"
      >
        {(data) => <FaviconHashResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
