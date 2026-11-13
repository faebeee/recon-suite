import type {
  ZoneRecord,
  ZoneTransferAttempt,
  ZoneTransferOutput,
} from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import type { Tone } from '@/lib/tones';

const STATUS_TONE: Record<ZoneTransferAttempt['status'], Tone> = {
  allowed: 'magenta',
  refused: 'green',
  timeout: 'yellow',
  error: 'muted',
};

/** Record types whose value ends in a hostname. */
const HOST_VALUE_TYPES = new Set(['NS', 'CNAME', 'PTR', 'MX', 'SRV', 'DNAME']);

const bare = (name: string) => name.replace(/\.$/, '');

function pivotValue(r: ZoneRecord): string | undefined {
  if (r.type === 'A' || r.type === 'AAAA') return r.value;
  if (HOST_VALUE_TYPES.has(r.type)) {
    const host = bare(r.value.split(' ').at(-1) ?? '');
    return host || undefined;
  }
  return undefined;
}

export function ZoneTransferResults({ data }: { data: ZoneTransferOutput }) {
  const allowed = data.attempts.filter((a) => a.status === 'allowed');
  return (
    <div className="grid gap-4">
      <Panel
        title={`Nameservers (${data.attempts.length})`}
        tone={allowed.length ? 'magenta' : 'cyan'}
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-border text-sm">
          {data.attempts.map((a) => (
            <li
              key={a.nameserver}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2"
            >
              <Tag tone={STATUS_TONE[a.status]}>{a.status}</Tag>
              <span
                className="min-w-0 truncate font-semibold"
                title={a.nameserver}
              >
                {a.nameserver}
              </span>
              {a.address && (
                <code className="text-xs text-muted-foreground">
                  {a.address}
                </code>
              )}
              {a.recordCount !== undefined && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {a.recordCount} records
                </span>
              )}
              <PivotLinks
                value={a.nameserver}
                exclude="zone-transfer"
                className="ml-auto"
              />
              {a.error && (
                <p className="w-full text-xs text-muted-foreground">
                  {a.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {allowed.map((a) => (
        <ZonePanel key={a.nameserver} attempt={a} />
      ))}

      <Panel title="Findings" bodyClassName="p-0">
        <FindingsList findings={data.findings} />
      </Panel>
    </div>
  );
}

function ZonePanel({ attempt }: { attempt: ZoneTransferAttempt }) {
  const records = attempt.records ?? [];
  return (
    <Panel
      title={`Zone from ${attempt.nameserver}`}
      tone="magenta"
      bodyClassName="p-0"
    >
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              <th className="px-4 py-1.5 font-normal">Name</th>
              <th className="py-1.5 pr-4 font-normal">Type</th>
              <th className="py-1.5 pr-4 font-normal">TTL</th>
              <th className="py-1.5 pr-4 font-normal">Value</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const target = pivotValue(r);
              return (
                <tr key={i} className="border-t border-border/50 align-top">
                  <td className="px-4 py-1.5">
                    <span className="inline-flex items-center gap-1">
                      <span className="break-all">{bare(r.name)}</span>
                      <PivotLinks
                        value={bare(r.name)}
                        exclude="zone-transfer"
                      />
                    </span>
                  </td>
                  <td className="py-1.5 pr-4">
                    <Tag tone="cyan">{r.type}</Tag>
                  </td>
                  <td className="py-1.5 pr-4 text-muted-foreground tabular-nums">
                    {r.ttl}
                  </td>
                  <td className="py-1.5 pr-4">
                    <span className="inline-flex items-start gap-1">
                      <code className="max-w-[28rem] break-all">{r.value}</code>
                      {target && (
                        <PivotLinks value={target} exclude="zone-transfer" />
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {attempt.truncated && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Showing {records.length} of {attempt.recordCount ?? records.length}{' '}
          records
          {attempt.error ? ` (${attempt.error})` : ''}
        </p>
      )}
    </Panel>
  );
}
