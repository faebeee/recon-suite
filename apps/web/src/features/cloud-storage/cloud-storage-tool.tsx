import { useState } from 'react';
import { MAX_EXTRA_BUCKET_NAMES, TOOL_CATALOG } from '@recon/shared';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { Input } from '@/components/ui/input';
import { useToolRunner } from '@/lib/use-tool-runner';
import { CloudStorageResults } from './cloud-storage-results';

export function CloudStorageTool({
  initialTarget,
}: {
  initialTarget?: string;
}) {
  const [extra, setExtra] = useState('');
  const runner = useToolRunner('cloud-storage', {
    initialTarget,
    buildInput: (target) => ({
      target,
      extraNames: extra.split(/[\s,]+/).filter(Boolean),
    }),
  });

  return (
    <ToolPage toolId="cloud-storage">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['cloud-storage'].targetHint}
        error={runner.validationError}
        label="Domain"
      >
        <FormOption label="Names">
          <Input
            aria-label="Extra bucket names"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={`extra bucket names, comma separated (max ${MAX_EXTRA_BUCKET_NAMES})`}
            className="h-8 max-w-md text-xs"
          />
        </FormOption>
      </TargetForm>
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Probing S3, GCS and Azure"
      >
        {(data) => <CloudStorageResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
