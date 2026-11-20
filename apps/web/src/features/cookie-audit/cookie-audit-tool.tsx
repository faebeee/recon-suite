import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { CookieAuditResults } from './cookie-audit-results';

export function CookieAuditTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('cookie-audit', {
    initialTarget,
    buildInput: (target) => ({ target }),
  });

  return (
    <ToolPage toolId="cookie-audit">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['cookie-audit'].targetHint}
        error={runner.validationError}
        label="URL"
      />
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Collecting cookies"
      >
        {(data) => <CookieAuditResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
