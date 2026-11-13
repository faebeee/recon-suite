import { useState } from 'react';
import { MAX_NMAP_PORTS, TOOL_CATALOG } from '@recon/shared';
import { Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { NmapResults } from './nmap-results';

type PortMode = 'top-100' | 'top-1000' | 'custom';
const PORT_MODES: { value: PortMode; label: string }[] = [
  { value: 'top-100', label: 'top 100' },
  { value: 'top-1000', label: 'top 1000' },
  { value: 'custom', label: 'custom' },
];

const DETECTION = [
  { value: 'on', label: 'versions' },
  { value: 'off', label: 'ports only' },
] as const;

/** "22, 80 8000-8010" -> [22, 80, 8000, ..., 8010] (same syntax as the Port Probe). */
function parsePorts(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .flatMap((part) => {
      const range = /^(\d+)-(\d+)$/.exec(part);
      if (!range) return part ? [Number(part)] : [];
      const [from, to] = [Number(range[1]), Number(range[2])];
      return Array.from(
        { length: Math.max(0, Math.min(to - from + 1, MAX_NMAP_PORTS + 1)) },
        (_, i) => from + i,
      );
    })
    .filter((n) => !Number.isNaN(n));
}

export function NmapTool({ initialTarget }: { initialTarget?: string }) {
  const [mode, setMode] = useState<PortMode>('top-100');
  const [custom, setCustom] = useState('22, 80, 443, 8000-8100');
  const [detection, setDetection] = useState<'on' | 'off'>('on');
  const runner = useToolRunner('nmap', {
    initialTarget,
    buildInput: (target) => ({
      target,
      topPorts: mode === 'top-1000' ? 1000 : 100,
      ports: mode === 'custom' ? parsePorts(custom) : undefined,
      serviceDetection: detection === 'on',
    }),
  });

  return (
    <ToolPage toolId="nmap">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.nmap.targetHint}
        error={runner.validationError}
        label="Host"
      >
        <FormOption label="Ports">
          <Segmented
            label="Ports to scan"
            options={PORT_MODES}
            value={mode}
            onChange={setMode}
          />
        </FormOption>
        {mode === 'custom' && (
          <FormOption label="Custom">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label="Custom ports"
              placeholder="22, 80, 8000-8100"
              className="h-8 w-full max-w-sm border border-input bg-background/60 px-2 text-sm outline-none focus:border-primary"
            />
            <span className="text-[11px] text-muted-foreground">
              max {MAX_NMAP_PORTS}
            </span>
          </FormOption>
        )}
        <FormOption label="Detect">
          <Segmented
            label="Service detection"
            options={[...DETECTION]}
            value={detection}
            onChange={setDetection}
          />
        </FormOption>
      </TargetForm>
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel="Running nmap (can take a few minutes)"
      >
        {(data) => <NmapResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
