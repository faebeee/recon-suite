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
import { TlsResults } from './tls-results';

const PORTS = [443, 465, 636, 853, 993, 995, 8443].map((value) => ({ value }));

export function TlsTool({ initialTarget }: { initialTarget?: string }) {
  const [port, setPort] = useState(443);
  const runner = useToolRunner('tls', {
    initialTarget,
    buildInput: (target) => ({ target, port }),
  });

  return (
    <ToolPage toolId="tls">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.tls.targetHint}
        error={runner.validationError}
        label="Host"
      >
        <FormOption label="Port">
          <Segmented
            label="Port"
            options={PORTS}
            value={port}
            onChange={setPort}
          />
        </FormOption>
      </TargetForm>
      <ToolResultView mutation={runner.mutation} loadingLabel="Handshaking">
        {(data) => <TlsResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
