import { useState } from 'react';
import { MAX_EXTRA_DKIM_SELECTORS, TOOL_CATALOG } from '@recon/shared';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { Input } from '@/components/ui/input';
import { useToolRunner } from '@/lib/use-tool-runner';
import { EmailSecurityResults } from './email-security-results';

export function EmailSecurityTool({
  initialTarget,
}: {
  initialTarget?: string;
}) {
  const [selectors, setSelectors] = useState('');
  const runner = useToolRunner('email-security', {
    initialTarget,
    buildInput: (target) => ({
      target,
      dkimSelectors: selectors.split(/[\s,]+/).filter(Boolean),
    }),
  });

  return (
    <ToolPage toolId="email-security">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['email-security'].targetHint}
        error={runner.validationError}
        label="Domain"
      >
        <FormOption label="DKIM">
          <Input
            aria-label="Extra DKIM selectors"
            value={selectors}
            onChange={(e) => setSelectors(e.target.value)}
            placeholder={`extra selectors, comma separated (max ${MAX_EXTRA_DKIM_SELECTORS})`}
            className="h-8 max-w-md text-xs"
          />
        </FormOption>
      </TargetForm>
      <ToolResultView mutation={runner.mutation} loadingLabel="Querying DNS">
        {(data) => <EmailSecurityResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
