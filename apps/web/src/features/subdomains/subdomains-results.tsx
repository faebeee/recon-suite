import { useMemo, useState } from 'react';
import type { SubdomainsOutput } from '@recon/shared';
import { CopyButton, Panel, Tag } from '@/components/cyber';
import { IntelViewExportButton, PivotLinks } from '@/components/tool';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { subdomainsDiscovery } from './subdomains-radar';

const PAGE = 200;

export function SubdomainsResults({
  data,
  target,
}: {
  data: SubdomainsOutput;
  target: string;
}) {
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q
      ? data.subdomains.filter((s) => s.name.includes(q))
      : data.subdomains;
  }, [data.subdomains, filter]);

  return (
    <Panel
      title={`${data.total} subdomains`}
      actions={
        <div className="flex items-center gap-1">
          <IntelViewExportButton
            tool="subdomains"
            discovery={subdomainsDiscovery(filtered, target)}
          />
          <CopyButton
            value={filtered.map((s) => s.name).join('\n')}
            label="Copy list"
          />
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="border-b border-border px-4 py-2">
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="filter…"
          aria-label="Filter subdomains"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No subdomains found in CT logs.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.slice(0, limit).map((s) => (
            <li
              key={s.name}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
            >
              <code className="min-w-0 flex-1 break-all">{s.name}</code>
              {s.wildcard && <Tag tone="yellow">wildcard</Tag>}
              <span className="text-xs text-muted-foreground">
                {formatDate(s.firstSeen)} → {formatDate(s.lastSeen)} ·{' '}
                {s.certificates} cert
                {s.certificates === 1 ? '' : 's'}
              </span>
              <PivotLinks value={s.name} exclude="subdomains" />
            </li>
          ))}
        </ul>
      )}
      {filtered.length > limit && (
        <div className="border-t border-border p-3 text-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLimit((l) => l + PAGE)}
          >
            Show more ({filtered.length - limit} left)
          </Button>
        </div>
      )}
    </Panel>
  );
}
