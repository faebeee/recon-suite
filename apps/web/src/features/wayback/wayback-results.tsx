import { useMemo, useState } from 'react';
import type { WaybackOutput } from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/format';
import type { Tone } from '@/lib/tones';

const MAX_ROWS = 1000;

function reasonTone(reason: string): Tone {
  if (/secret|config|in query/.test(reason)) return 'magenta';
  if (/backup|log/.test(reason)) return 'yellow';
  return 'cyan';
}

function statusTone(status: number | undefined): Tone {
  if (status === undefined) return 'muted';
  if (status < 300) return 'green';
  if (status < 400) return 'cyan';
  return 'yellow';
}

export function WaybackResults({ data }: { data: WaybackOutput }) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q
      ? data.urls.filter((u) => u.url.toLowerCase().includes(q))
      : data.urls;
  }, [data.urls, filter]);
  const shown = filtered.slice(0, MAX_ROWS);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Summary" className="lg:col-span-2">
        <KeyValueGrid
          className="sm:grid-cols-4"
          items={[
            { label: 'Domain', value: data.domain },
            {
              label: 'Distinct URLs',
              value: (
                <span className="inline-flex items-center gap-2">
                  {data.total}
                  {data.truncated && <Tag tone="yellow">limit reached</Tag>}
                </span>
              ),
            },
            { label: 'Interesting', value: data.interesting.length },
            { label: 'Source', value: data.source },
          ]}
        />
      </Panel>

      <Panel
        title={`Interesting (${data.interesting.length})`}
        tone={data.interesting.length ? 'yellow' : 'cyan'}
        className="lg:col-span-2"
        bodyClassName="p-0"
      >
        {data.interesting.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Nothing notable in the archived URLs.
          </p>
        ) : (
          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto text-sm">
            {data.interesting.map((i) => (
              <li
                key={i.url}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2"
              >
                <Tag tone={reasonTone(i.reason)}>{i.reason}</Tag>
                <code className="min-w-0 flex-1 truncate text-xs" title={i.url}>
                  {i.url}
                </code>
                <PivotLinks value={i.url} exclude="wayback" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Parameters (${data.parameters.length})`}>
        <TagCloud
          items={data.parameters.map((p) => ({
            label: p.name,
            count: p.count,
          }))}
          empty="No query parameters seen."
        />
      </Panel>

      <Panel title={`Extensions (${data.extensions.length})`}>
        <TagCloud
          items={data.extensions.map((e) => ({
            label: `.${e.ext}`,
            count: e.count,
          }))}
          empty="No file extensions seen."
        />
      </Panel>

      <Panel
        title="Archived URLs"
        className="lg:col-span-2"
        bodyClassName="p-0"
        actions={
          <span className="text-xs text-muted-foreground tabular-nums">
            {shown.length < filtered.length
              ? `${shown.length} of ${filtered.length}`
              : filtered.length}
          </span>
        }
      >
        <div className="border-b border-border p-3">
          <Input
            aria-label="Filter URLs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter URLs, e.g. .php or /api/"
            className="h-8 text-xs"
          />
        </div>
        <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto text-sm">
          {shown.map((u) => (
            <li
              key={u.url}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5"
            >
              <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatDate(u.lastSeen)}
              </span>
              <Tag tone={statusTone(u.status)} className="w-10 justify-center">
                {u.status ?? '-'}
              </Tag>
              <code className="min-w-0 flex-1 truncate text-xs" title={u.url}>
                {u.url}
              </code>
              {u.mimeType && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {u.mimeType}
                </span>
              )}
            </li>
          ))}
          {shown.length === 0 && (
            <li className="px-4 py-3 text-muted-foreground">No URLs</li>
          )}
        </ul>
      </Panel>
    </div>
  );
}

function TagCloud({
  items,
  empty,
}: {
  items: { label: string; count: number }[];
  empty: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Tag key={i.label} tone="cyan" className="tracking-normal normal-case">
          {i.label}
          <span className="text-muted-foreground tabular-nums">{i.count}</span>
        </Tag>
      ))}
    </div>
  );
}
