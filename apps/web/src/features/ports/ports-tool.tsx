import { useState } from 'react';
import { MAX_PORTS_PER_SCAN, PORT_PRESETS, TOOL_CATALOG } from '@recon/shared';
import { Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { PortsResults } from './ports-results';

type Preset = keyof typeof PORT_PRESETS | 'custom';
const PRESETS = [...Object.keys(PORT_PRESETS), 'custom'].map((value) => ({
  value: value as Preset,
}));

function parsePorts(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .flatMap((part) => {
      const range = /^(\d+)-(\d+)$/.exec(part);
      if (!range) return part ? [Number(part)] : [];
      const [from, to] = [Number(range[1]), Number(range[2])];
      return Array.from(
        {
          length: Math.max(0, Math.min(to - from + 1, MAX_PORTS_PER_SCAN + 1)),
        },
        (_, i) => from + i,
      );
    })
    .filter((n) => !Number.isNaN(n));
}

export function PortsTool({ initialTarget }: { initialTarget?: string }) {
  const [preset, setPreset] = useState<Preset>('common');
  const [custom, setCustom] = useState('22, 80, 443, 8000-8010');
  const runner = useToolRunner('ports', {
    initialTarget,
    buildInput: (target) => ({
      target,
      ports:
        preset === 'custom' ? parsePorts(custom) : [...PORT_PRESETS[preset]],
    }),
  });

  return (
    <ToolPage toolId="ports">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.ports.targetHint}
        error={runner.validationError}
        label="Host"
      >
        <FormOption label="Ports">
          <Segmented
            label="Port preset"
            options={PRESETS}
            value={preset}
            onChange={setPreset}
          />
        </FormOption>
        {preset === 'custom' && (
          <FormOption label="Custom">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label="Custom ports"
              placeholder="22, 80, 8000-8010"
              className="h-8 w-full max-w-sm border border-input bg-background/60 px-2 text-sm outline-none focus:border-primary"
            />
            <span className="text-[11px] text-muted-foreground">
              max {MAX_PORTS_PER_SCAN}
            </span>
          </FormOption>
        )}
      </TargetForm>
      <ToolResultView mutation={runner.mutation} loadingLabel="Probing ports">
        {(data) => <PortsResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
