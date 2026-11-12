import { useState } from 'react';
import { TOOL_CATALOG } from '@recon/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { HttpHeadersResults } from './http-headers-results';

export function HttpHeadersTool({ initialTarget }: { initialTarget?: string }) {
  const [method, setMethod] = useState<'GET' | 'HEAD'>('GET');
  const [followRedirects, setFollowRedirects] = useState(true);
  const runner = useToolRunner('http-headers', {
    initialTarget,
    buildInput: (target) => ({ target, method, followRedirects }),
  });

  return (
    <ToolPage toolId="http-headers">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['http-headers'].targetHint}
        error={runner.validationError}
        label="URL"
      >
        <FormOption label="Method">
          <Segmented
            label="HTTP method"
            options={[{ value: 'GET' }, { value: 'HEAD' }]}
            value={method}
            onChange={setMethod}
          />
        </FormOption>
        <FormOption label="Redirects">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={followRedirects}
              onCheckedChange={(v) => setFollowRedirects(v === true)}
            />
            Follow redirect chain (max 10)
          </label>
        </FormOption>
      </TargetForm>
      <ToolResultView mutation={runner.mutation} loadingLabel="Inspecting">
        {(data) => <HttpHeadersResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
