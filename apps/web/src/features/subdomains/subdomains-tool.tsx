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
import { SubdomainsResults } from './subdomains-results';
import { SubdomainsRadar } from './subdomains-radar';

export function SubdomainsTool({ initialTarget }: { initialTarget?: string }) {
  const [includeExpired, setIncludeExpired] = useState(false);
  const runner = useToolRunner('subdomains', {
    initialTarget,
    buildInput: (target) => ({ target, includeExpired }),
  });

  return (
    <ToolPage toolId="subdomains">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.subdomains.targetHint}
        error={runner.validationError}
        label="Domain"
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
        loadingLabel="Mining CT logs (can take ~30s)"
      >
        {(data, result) => (
          <>
            <SubdomainsRadar data={data} target={result.target} />
            <SubdomainsResults data={data} />
          </>
        )}
      </ToolResultView>
    </ToolPage>
  );
}
