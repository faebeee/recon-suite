import { Link } from '@tanstack/react-router';
import type { NmapOutput } from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { cn } from '@/lib/utils';
import { toneText } from '@/lib/tones';

export function NmapResults({ data }: { data: NmapOutput }) {
  return (
    <div className="space-y-4">
      <Panel
        title={data.address}
        actions={
          <span className="flex flex-wrap gap-3 text-[11px] tracking-wider uppercase">
            <span className={toneText.green}>{data.ports.length} open</span>
            <span className="text-muted-foreground">
              {data.scannedPorts} scanned
            </span>
          </span>
        }
      >
        <KeyValueGrid
          items={[
            {
              label: 'Host',
              value: (
                <Tag tone={data.hostState === 'up' ? 'green' : 'muted'}>
                  {data.hostState}
                </Tag>
              ),
            },
            { label: 'nmap', value: data.nmapVersion },
            {
              label: 'Elapsed',
              value:
                data.elapsedSeconds !== undefined
                  ? `${data.elapsedSeconds.toFixed(1)}s`
                  : undefined,
            },
            {
              label: 'Command',
              value: (
                <code className="text-xs break-all text-foreground/80">
                  {data.method}
                </code>
              ),
            },
          ]}
        />
        <PivotLinks value={data.address} exclude="nmap" className="mt-4" />
      </Panel>

      <Panel title="Open ports" bodyClassName="p-0">
        {data.ports.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No open ports found in the scanned range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-normal">Port</th>
                  <th className="px-2 py-2 font-normal">Service</th>
                  <th className="px-2 py-2 font-normal">Product</th>
                  <th className="px-4 py-2 font-normal">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.ports.map((p) => (
                  <tr key={`${p.protocol}/${p.port}`} className="align-top">
                    <td
                      className={cn(
                        'px-4 py-2 font-display font-bold whitespace-nowrap',
                        toneText.green,
                      )}
                    >
                      {p.port}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        /{p.protocol}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs">
                      <span className="flex flex-wrap items-center gap-1">
                        {p.service ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                        {p.method === 'table' && (
                          <Tag tone="muted">guessed</Tag>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {p.product ? (
                        <span className="flex flex-col gap-0.5">
                          <span>
                            {p.product}
                            {p.version && (
                              <span className="text-muted-foreground">
                                {' '}
                                {p.version}
                              </span>
                            )}
                          </span>
                          {p.version && (
                            <Link
                              to="/tools/cve-lookup"
                              search={{ target: `${p.product} ${p.version}` }}
                              className={cn(
                                'text-[10px] tracking-[0.15em] uppercase hover:underline',
                                toneText.magenta,
                              )}
                              aria-label={`Look up CVEs for ${p.product} ${p.version}`}
                            >
                              CVEs →
                            </Link>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="max-w-[28rem] min-w-[12rem] px-4 py-2 text-xs text-muted-foreground">
                      {p.extraInfo && (
                        <p className="text-foreground/80">{p.extraInfo}</p>
                      )}
                      {p.cpe.map((c) => (
                        <code key={c} className="block break-all">
                          {c}
                        </code>
                      ))}
                      {!p.extraInfo && !p.cpe.length && '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
