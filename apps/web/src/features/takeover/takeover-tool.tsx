import { useState } from 'react';
import { MAX_TAKEOVER_HOSTS, TOOL_CATALOG } from '@recon/shared';
import { Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { Input } from '@/components/ui/input';
import { useToolRunner } from '@/lib/use-tool-runner';
import { TakeoverResults } from './takeover-results';

type Source = 'ct' | 'list';

export function TakeoverTool({ initialTarget }: { initialTarget?: string }) {
  const [source, setSource] = useState<Source>('ct');
  const [hosts, setHosts] = useState('');
  const runner = useToolRunner('takeover', {
    initialTarget,
    buildInput: (target) => ({
      target,
      source,
      hosts: [
        ...new Set(
          hosts
            .split(/[\s,]+/)
            .map((h) => h.trim().toLowerCase())
            .filter(Boolean),
        ),
      ].slice(0, MAX_TAKEOVER_HOSTS),
    }),
  });

  return (
    <ToolPage toolId="takeover">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.takeover.targetHint}
        error={runner.validationError}
        label="Domain"
      >
        <FormOption label="Source">
          <Segmented<Source>
            label="Host source"
            value={source}
            onChange={setSource}
            options={[
              { value: 'ct', label: 'CT logs' },
              { value: 'list', label: 'My list' },
            ]}
          />
        </FormOption>
        <FormOption label="Hosts">
          <Input
            aria-label="Extra hostnames"
            value={hosts}
            onChange={(e) => setHosts(e.target.value)}
            placeholder={`extra hosts, comma or space separated (max ${MAX_TAKEOVER_HOSTS})`}
            className="h-8 max-w-md text-xs"
          />
        </FormOption>
      </TargetForm>
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel={
          source === 'ct'
            ? 'Loading CT subdomains and resolving'
            : 'Resolving hosts'
        }
      >
        {(data) => <TakeoverResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
