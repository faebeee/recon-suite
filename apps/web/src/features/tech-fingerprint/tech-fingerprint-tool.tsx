import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { TechFingerprintResults } from './tech-fingerprint-results';

export function TechFingerprintTool({
  initialTarget,
}: {
  initialTarget?: string;
}) {
  const runner = useToolRunner('tech-fingerprint', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="tech-fingerprint">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['tech-fingerprint'].targetHint}
        error={runner.validationError}
        label="URL"
      />
      <ToolResultView mutation={runner.mutation} loadingLabel="Fingerprinting">
        {(data) => <TechFingerprintResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
