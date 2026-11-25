import { useState } from 'react';
import { TOOL_CATALOG } from '@recon/shared';
import { Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { Checkbox } from '@/components/ui/checkbox';
import { useToolRunner } from '@/lib/use-tool-runner';
import { WaybackResults } from './wayback-results';
import { waybackIntelView } from './wayback-intel-view';

const LIMITS = [500, 1000, 5000].map((value) => ({ value }));

export function WaybackTool({ initialTarget }: { initialTarget?: string }) {
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [limit, setLimit] = useState(1000);
  const runner = useToolRunner('wayback', {
    initialTarget,
    buildInput: (target) => ({ target, includeSubdomains, limit }),
  });

  return (
    <ToolPage toolId="wayback">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.wayback.targetHint}
        error={runner.validationError}
        label="Domain"
      >
        <FormOption label="Scope">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              checked={includeSubdomains}
              onCheckedChange={(v) => setIncludeSubdomains(v === true)}
            />
            Include subdomains
          </label>
        </FormOption>
        <FormOption label="Limit">
          <Segmented
            label="Maximum URLs"
            options={LIMITS}
            value={limit}
            onChange={setLimit}
          />
        </FormOption>
      </TargetForm>
      <ToolResultView
        intelView={waybackIntelView}
        mutation={runner.mutation}
        loadingLabel="Querying the Internet Archive (can take up to a minute)"
      >
        {(data) => <WaybackResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
