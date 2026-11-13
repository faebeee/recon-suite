import { useState } from 'react';
import { TOOL_CATALOG } from '@recon/shared';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { CertSearchResults } from './cert-search-results';

export function CertSearchTool({ initialTarget }: { initialTarget?: string }) {
  const [includeExpired, setIncludeExpired] = useState(false);
  const runner = useToolRunner('cert-search', {
    initialTarget,
    buildInput: (target) => ({ target, includeExpired }),
  });

  return (
    <ToolPage toolId="cert-search">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['cert-search'].targetHint}
        error={runner.validationError}
        label="Organisation"
      >
        <FormOption label="Scope">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={includeExpired}
              onCheckedChange={(v) => setIncludeExpired(v === true)}
            />
            Include expired certificates
          </label>
        </FormOption>
      </TargetForm>
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Searching CT logs (can take ~60s)"
      >
        {(data) => <CertSearchResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
