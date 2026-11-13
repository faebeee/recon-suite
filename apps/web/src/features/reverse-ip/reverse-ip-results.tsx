import { useMemo, useState } from 'react';
import type { ReverseIpOutput } from '@recon/shared';
import { CopyButton, KeyValueGrid, Panel } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';

export function ReverseIpResults({ data }: { data: ReverseIpOutput }) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? data.domains.filter((d) => d.includes(q)) : data.domains;
  }, [data.domains, filter]);

  return (
    <div className="space-y-4">
      <Panel
        title={data.ip}
        code="IP"
        actions={<PivotLinks value={data.ip} exclude="reverse-ip" />}
      >
        <div className="space-y-3">
          <KeyValueGrid
            className="lg:grid-cols-3"
            items={[
              { label: 'Resolved from', value: data.resolvedFrom },
              { label: 'Hostnames known', value: String(data.total) },
              { label: 'Source', value: 'SecurityTrails' },
            ]}
          />
          {data.truncated && (
            <p className="text-xs text-muted-foreground">
              Showing the first {data.domains.length} of {data.total} hostnames
              (first result page only).
            </p>
          )}
        </div>
      </Panel>

      <Panel
        title={`${data.domains.length} hostnames`}
        actions={<CopyButton value={filtered.join('\n')} label="Copy list" />}
        bodyClassName="p-0"
      >
        <div className="border-b border-border px-4 py-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter…"
            aria-label="Filter hostnames"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {data.domains.length
              ? 'No hostnames match the filter.'
              : 'SecurityTrails knows no hostnames on this address.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((d) => (
              <li
                key={d}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
              >
                <code className="min-w-0 flex-1 break-all">{d}</code>
                <PivotLinks value={d} exclude="reverse-ip" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
