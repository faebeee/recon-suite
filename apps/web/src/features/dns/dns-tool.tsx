import { useState } from 'react';
import {
  DNS_RECORD_TYPES,
  DNS_RESOLVERS,
  TOOL_CATALOG,
  type DnsRecordType,
  type DnsResolver,
} from '@recon/shared';
import { ChipToggle, Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { DnsResults } from './dns-results';

const RESOLVERS = Object.keys(DNS_RESOLVERS) as DnsResolver[];

export function DnsTool({ initialTarget }: { initialTarget?: string }) {
  const [types, setTypes] = useState<DnsRecordType[]>([...DNS_RECORD_TYPES]);
  const [resolver, setResolver] = useState<DnsResolver>('cloudflare');
  const runner = useToolRunner('dns', {
    initialTarget,
    buildInput: (target) => ({ target, types, resolver }),
  });

  return (
    <ToolPage toolId="dns">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.dns.targetHint}
        error={runner.validationError}
        label="Domain"
      >
        <FormOption label="Records">
          <ChipToggle
            label="Record types"
            options={DNS_RECORD_TYPES.map((t) => ({ value: t }))}
            value={types}
            onChange={setTypes}
          />
        </FormOption>
        <FormOption label="Resolver">
          <Segmented
            label="Resolver"
            options={RESOLVERS.map((r) => ({ value: r }))}
            value={resolver}
            onChange={setResolver}
          />
        </FormOption>
      </TargetForm>
      <ToolResultView mutation={runner.mutation} loadingLabel="Resolving">
        {(data) => <DnsResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
