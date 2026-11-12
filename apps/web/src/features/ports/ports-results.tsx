import type { PortState, PortsOutput } from '@recon/shared';
import { Panel } from '@/components/cyber';
import { cn } from '@/lib/utils';
import { toneBorder, toneSoftBg, toneText, type Tone } from '@/lib/tones';

const STATE_TONE: Record<PortState, Tone> = {
  open: 'green',
  closed: 'magenta',
  filtered: 'muted',
};

export function PortsResults({ data }: { data: PortsOutput }) {
  const counts = data.results.reduce<Record<PortState, number>>(
    (acc, r) => ({ ...acc, [r.state]: acc[r.state] + 1 }),
    { open: 0, closed: 0, filtered: 0 },
  );

  return (
    <Panel
      title={`${data.address}`}
      actions={
        <span className="flex gap-3 text-[11px] tracking-wider uppercase">
          {(Object.keys(counts) as PortState[]).map((s) => (
            <span key={s} className={toneText[STATE_TONE[s]]}>
              {counts[s]} {s}
            </span>
          ))}
        </span>
      }
    >
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {data.results.map((r) => {
          const tone = STATE_TONE[r.state];
          return (
            <li
              key={r.port}
              className={cn(
                'border px-3 py-2',
                toneBorder[tone],
                r.state === 'open' &&
                  cn(
                    toneSoftBg[tone],
                    'shadow-[0_0_16px_-6px] shadow-neon-green',
                  ),
                r.state === 'filtered' && 'opacity-60',
              )}
            >
              <p
                className={cn(
                  'font-display text-lg font-bold',
                  toneText[tone],
                  r.state === 'open' && 'text-glow',
                )}
              >
                {r.port}
              </p>
              <p className="flex justify-between text-[10px] tracking-wider text-muted-foreground uppercase">
                <span>{r.service ?? 'unknown'}</span>
                <span className={toneText[tone]}>{r.state}</span>
              </p>
              {r.latencyMs !== undefined && (
                <p className="text-[10px] text-muted-foreground">
                  {r.latencyMs}ms
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
