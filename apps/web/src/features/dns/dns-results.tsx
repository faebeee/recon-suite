import type { DnsOutput, DnsRecordType } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';

/** Record types whose values are hostnames or IPs worth pivoting on. */
const PIVOTABLE = new Set<DnsRecordType>(['A', 'AAAA', 'CNAME', 'NS']);

function pivotValue(type: DnsRecordType, value: string): string | null {
  if (PIVOTABLE.has(type)) return value.replace(/\.$/, '');
  if (type === 'MX') return value.split(' ')[1]?.replace(/\.$/, '') || null;
  return null;
}

export function DnsResults({ data }: { data: DnsOutput }) {
  const found = data.records.filter((r) => r.values.length).length;
  return (
    <Panel
      title="Records"
      actions={
        <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
          {found}/{data.records.length} types · {data.resolver} (
          {data.servers.join(', ')})
        </span>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-border">
        {data.records.map((set) => (
          <li
            key={set.type}
            className="grid gap-2 px-4 py-3 sm:grid-cols-[5rem_1fr]"
          >
            <div>
              <Tag tone={set.values.length ? 'cyan' : 'muted'}>{set.type}</Tag>
            </div>
            <div className="min-w-0 space-y-1 text-sm">
              {set.error && (
                <p className="text-xs text-neon-magenta">
                  query failed: {set.error}
                </p>
              )}
              {!set.error && set.values.length === 0 && (
                <p className="text-muted-foreground/60">no records</p>
              )}
              {set.values.map((value) => {
                const pivot = pivotValue(set.type, value);
                return (
                  <div
                    key={value}
                    className="flex items-start justify-between gap-2"
                  >
                    <code className="min-w-0 break-all">{value}</code>
                    {pivot && (
                      <PivotLinks
                        value={pivot}
                        exclude="dns"
                        className="shrink-0"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
