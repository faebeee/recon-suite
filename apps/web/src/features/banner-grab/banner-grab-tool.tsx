import { useState } from 'react';
import {
  BANNER_DEFAULT_PORTS,
  MAX_BANNER_PORTS,
  TOOL_CATALOG,
} from '@recon/shared';
import { Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { BannerGrabResults } from './banner-grab-results';
import { bannerGrabIntelView } from './banner-grab-intel-view';

const TIMEOUTS = [1000, 3000, 5000].map((value) => ({
  value,
  label: `${value / 1000}s`,
}));

/** "21, 22 8000-8003" -> [21, 22, 8000, 8001, 8002, 8003] (same syntax as the Port Probe). */
function parsePorts(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .flatMap((part) => {
      const range = /^(\d+)-(\d+)$/.exec(part);
      if (!range) return part ? [Number(part)] : [];
      const [from, to] = [Number(range[1]), Number(range[2])];
      return Array.from(
        {
          length: Math.max(0, Math.min(to - from + 1, MAX_BANNER_PORTS + 1)),
        },
        (_, i) => from + i,
      );
    })
    .filter((n) => !Number.isNaN(n));
}

export function BannerGrabTool({ initialTarget }: { initialTarget?: string }) {
  const [ports, setPorts] = useState(BANNER_DEFAULT_PORTS.join(', '));
  const [timeoutMs, setTimeoutMs] = useState(3000);
  const runner = useToolRunner('banner-grab', {
    initialTarget,
    buildInput: (target) => ({ target, ports: parsePorts(ports), timeoutMs }),
  });

  return (
    <ToolPage toolId="banner-grab">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['banner-grab'].targetHint}
        error={runner.validationError}
        label="Host"
      >
        <FormOption label="Ports">
          <input
            value={ports}
            onChange={(e) => setPorts(e.target.value)}
            aria-label="Ports"
            placeholder="21, 22, 25, 8000-8003"
            className="h-8 w-full max-w-sm border border-input bg-background/60 px-2 text-sm outline-none focus:border-primary"
          />
          <span className="text-[11px] text-muted-foreground">
            max {MAX_BANNER_PORTS}
          </span>
        </FormOption>
        <FormOption label="Timeout">
          <Segmented
            label="Read timeout"
            options={TIMEOUTS}
            value={timeoutMs}
            onChange={setTimeoutMs}
          />
        </FormOption>
      </TargetForm>
      <ToolResultView
        intelView={(d, r) => bannerGrabIntelView(d, r.target)}
        mutation={runner.mutation}
        loadingLabel="Grabbing banners"
      >
        {(data) => <BannerGrabResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
