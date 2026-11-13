import { useState } from 'react';
import { MAX_JS_SCRIPTS, TOOL_CATALOG } from '@recon/shared';
import { Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { JsEndpointsResults } from './js-endpoints-results';

const LIMITS = [5, 15, MAX_JS_SCRIPTS].map((value) => ({ value }));

export function JsEndpointsTool({ initialTarget }: { initialTarget?: string }) {
  const [maxScripts, setMaxScripts] = useState(15);
  const runner = useToolRunner('js-endpoints', {
    initialTarget,
    buildInput: (target) => ({ target, maxScripts }),
  });

  return (
    <ToolPage toolId="js-endpoints">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['js-endpoints'].targetHint}
        error={runner.validationError}
        label="Page URL"
      >
        <FormOption label="Scripts">
          <Segmented
            label="Maximum same-site scripts to download"
            options={LIMITS}
            value={maxScripts}
            onChange={setMaxScripts}
          />
        </FormOption>
      </TargetForm>
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Downloading and parsing scripts"
      >
        {(data) => <JsEndpointsResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
