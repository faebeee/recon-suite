import { Link } from '@tanstack/react-router';
import type { BannerGrabOutput, BannerState } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { cn } from '@/lib/utils';
import { toneText, type Tone } from '@/lib/tones';

const STATE_TONE: Record<BannerState, Tone> = {
  banner: 'green',
  silent: 'cyan',
  closed: 'magenta',
  filtered: 'muted',
  error: 'yellow',
};

const STATES = Object.keys(STATE_TONE) as BannerState[];

export function BannerGrabResults({ data }: { data: BannerGrabOutput }) {
  const counts = STATES.map(
    (s) => [s, data.results.filter((r) => r.state === s).length] as const,
  ).filter(([, n]) => n > 0);

  return (
    <Panel
      title={data.address}
      actions={
        <span className="flex flex-wrap gap-3 text-[11px] tracking-wider uppercase">
          {counts.map(([s, n]) => (
            <span key={s} className={toneText[STATE_TONE[s]]}>
              {n} {s}
            </span>
          ))}
        </span>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-normal">Port</th>
              <th className="px-2 py-2 font-normal">State</th>
              <th className="px-2 py-2 font-normal">Service</th>
              <th className="px-2 py-2 font-normal">Product</th>
              <th className="px-4 py-2 font-normal">Banner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.results.map((r) => (
              <tr
                key={r.port}
                className={cn(
                  'align-top',
                  r.state === 'filtered' && 'opacity-60',
                )}
              >
                <td
                  className={cn(
                    'px-4 py-2 font-display font-bold',
                    toneText[STATE_TONE[r.state]],
                  )}
                >
                  {r.port}
                </td>
                <td className="px-2 py-2">
                  <span className="flex flex-wrap gap-1">
                    <Tag tone={STATE_TONE[r.state]}>{r.state}</Tag>
                    {r.tls && <Tag tone="cyan">tls</Tag>}
                  </span>
                </td>
                <td className="px-2 py-2 text-xs">
                  {r.service ?? (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-2 py-2 text-xs">
                  {r.product ? (
                    <span className="flex flex-col gap-0.5">
                      <span>
                        {r.product}
                        {r.version && (
                          <span className="text-muted-foreground">
                            {' '}
                            {r.version}
                          </span>
                        )}
                      </span>
                      {r.version && (
                        <Link
                          to="/tools/cve-lookup"
                          search={{ target: `${r.product} ${r.version}` }}
                          className={cn(
                            'text-[10px] tracking-[0.15em] uppercase hover:underline',
                            toneText.magenta,
                          )}
                          aria-label={`Look up CVEs for ${r.product} ${r.version}`}
                        >
                          CVEs →
                        </Link>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="max-w-[28rem] min-w-[12rem] px-4 py-2">
                  {r.banner ? (
                    <code className="block max-h-40 overflow-auto text-xs break-all whitespace-pre-wrap text-foreground/80">
                      {r.banner}
                    </code>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {r.error ?? STATE_HINT[r.state]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const STATE_HINT: Record<BannerState, string> = {
  banner: '',
  silent: 'Connected, but the service waits for the client to speak first.',
  closed: 'Connection refused.',
  filtered: 'No answer (filtered or host down).',
  error: 'Connection failed.',
};
