import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { DnssecResults } from './dnssec-results';

export function DnssecTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('dnssec', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="dnssec">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.dnssec.targetHint}
        error={runner.validationError}
        label="Domain"
      />
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Validating chain of trust"
      >
        {(data) => <DnssecResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
