import type { DnsblCheck, DnsblOutput, DnsblStatus } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import { toneText, type Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<DnsblStatus, Tone> = {
  listed: 'magenta',
  clean: 'green',
  refused: 'yellow',
  error: 'muted',
};

function statusTone(c: DnsblCheck): Tone {
  return c.policyOnly ? 'yellow' : STATUS_TONE[c.status];
}

export function DnsblResults({ data }: { data: DnsblOutput }) {
  const subjects = [...new Set(data.checks.map((c) => c.subject))];
  const problems = data.findings.filter((f) => f.status === 'fail');
  const refused = data.checks.some((c) => c.status === 'refused');

  return (
    <div className="grid gap-4">
      {refused && (
        <Panel title="Resolver refused" tone="yellow">
          <p className="text-sm text-muted-foreground">
            Some lists refused the queries. Spamhaus does not answer queries
            that come through large public resolvers (
            {data.resolvers.join(', ')}). Run the API on a machine with its own
            or an ISP resolver for complete results.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Summary" bodyClassName="p-0">
          <div className="space-y-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <p>
              {data.kind === 'domain' ? 'Domain' : 'IP'}{' '}
              <span className="text-foreground">{data.query}</span>
              {data.addresses.length > 0 &&
                data.kind === 'domain' &&
                ` · IPv4 ${data.addresses.join(', ')}`}
            </p>
            {data.skippedIpv6.length > 0 && (
              <p>IPv6 not checked: {data.skippedIpv6.join(', ')}</p>
            )}
            <p>Resolver: {data.resolvers.join(', ') || 'system'}</p>
          </div>
          {problems.length ? (
            <FindingsList findings={problems} />
          ) : (
            <p className={cn('px-4 py-3 text-sm', toneText.green)}>
              Not listed as a spam or abuse source on any list that answered.
            </p>
          )}
        </Panel>
        <Panel title="Pivots">
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <span key={s} className="flex items-center gap-2 text-xs">
                <code>{s}</code>
                <PivotLinks value={s} exclude="dnsbl" />
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Lists" bodyClassName="p-0">
        <div className="overflow-x-auto px-4 py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                <th className="py-1 pr-4 font-normal">List</th>
                <th className="py-1 pr-4 font-normal">Checked</th>
                <th className="py-1 pr-4 font-normal">Status</th>
                <th className="py-1 font-normal">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.checks.map((c) => (
                <tr
                  key={`${c.zone}|${c.subject}`}
                  className="border-t border-border/50 align-top"
                >
                  <td className="py-1.5 pr-4">
                    <p className="font-semibold">{c.list}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.zone}
                    </p>
                  </td>
                  <td className="py-1.5 pr-4 break-all">{c.subject}</td>
                  <td className="py-1.5 pr-4">
                    <Tag tone={statusTone(c)}>
                      {c.policyOnly ? 'policy' : c.status}
                    </Tag>
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {c.reasons.join(', ') || c.error}
                    {c.codes.length > 0 && (
                      <span className="block text-foreground/60">
                        {c.codes.join(', ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
