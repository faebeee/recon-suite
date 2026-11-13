import { useMemo, useState } from 'react';
import type { CertSearchOutput } from '@recon/shared';
import { CopyButton, Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';

const PAGE = 200;
const APEX_SHOWN = 40;

export function CertSearchResults({ data }: { data: CertSearchOutput }) {
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? data.domains.filter((d) => d.name.includes(q)) : data.domains;
  }, [data.domains, filter]);

  if (data.certificates === 0) {
    return (
      <Panel title="No certificates">
        <p className="text-sm text-muted-foreground">
          crt.sh found no matching certificates with subject organisation "
          {data.organisation}". The name must match the O= field, e.g. "Example
          Inc" or "Example GmbH". Domain-validated certificates (Let's Encrypt
          etc.) carry no organisation.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title={`${data.apexDomains.length} apex domains`}
        code="CT"
        actions={
          <span className="text-[11px] text-muted-foreground">
            {data.certificates} certificates
          </span>
        }
      >
        <ul className="flex flex-wrap gap-2">
          {data.apexDomains.slice(0, APEX_SHOWN).map((d) => (
            <li
              key={d}
              className="flex items-center gap-1 border border-border px-2 py-0.5 text-xs"
            >
              <code>{d}</code>
              <PivotLinks value={d} exclude="cert-search" />
            </li>
          ))}
        </ul>
        {data.apexDomains.length > APEX_SHOWN && (
          <p className="mt-2 text-xs text-muted-foreground">
            +{data.apexDomains.length - APEX_SHOWN} more (see the names below)
          </p>
        )}
      </Panel>

      <Panel
        title={`${data.domains.length} names`}
        actions={
          <CopyButton
            value={filtered.map((d) => d.name).join('\n')}
            label="Copy list"
          />
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
            aria-label="Filter names"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {data.domains.length
              ? 'No names match the filter.'
              : 'The matching certificates name no hostnames.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.slice(0, limit).map((d) => (
              <li
                key={d.name}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
              >
                <code className="min-w-0 flex-1 break-all">{d.name}</code>
                {d.wildcard && <Tag tone="yellow">wildcard</Tag>}
                <span className="text-xs text-muted-foreground">
                  {formatDate(d.firstSeen)} → {formatDate(d.lastSeen)} ·{' '}
                  {d.certificates} cert{d.certificates === 1 ? '' : 's'}
                </span>
                <PivotLinks value={d.name} exclude="cert-search" />
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
    </div>
  );
}
