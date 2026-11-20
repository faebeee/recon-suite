import { useState } from 'react';
import { TOOL_CATALOG } from '@recon/shared';
import { Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { WafDetectResults } from './waf-detect-results';

type Probe = 'on' | 'off';

export function WafDetectTool({ initialTarget }: { initialTarget?: string }) {
  const [probe, setProbe] = useState<Probe>('on');
  const runner = useToolRunner('waf-detect', {
    initialTarget,
    buildInput: (target) => ({ target, probe: probe === 'on' }),
  });

  return (
    <ToolPage toolId="waf-detect">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['waf-detect'].targetHint}
        error={runner.validationError}
        label="URL"
      >
        <FormOption label="Trigger request">
          <Segmented<Probe>
            label="Trigger request"
            value={probe}
            onChange={setProbe}
            options={[
              { value: 'on', label: 'Send' },
              { value: 'off', label: 'Plain GET only' },
            ]}
          />
        </FormOption>
      </TargetForm>
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Fingerprinting edge"
      >
        {(data) => <WafDetectResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
