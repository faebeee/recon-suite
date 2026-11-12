import type { WhoisOutput } from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { formatDate } from '@/lib/format';

const EVENT_TONE: Record<string, 'green' | 'yellow' | 'cyan'> = {
  registration: 'green',
  expiration: 'yellow',
};

export function WhoisResults({ data }: { data: WhoisOutput }) {
  const expiry = data.events.find((e) => e.action === 'expiration');
  const daysLeft = expiry
    ? Math.floor((Date.parse(expiry.date) - Date.now()) / 86_400_000)
    : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Registration" className="lg:col-span-2">
        <KeyValueGrid
          className="lg:grid-cols-4"
          items={[
            { label: 'Object', value: data.name },
            { label: 'Type', value: <Tag>{data.kind}</Tag> },
            { label: 'Handle', value: data.handle },
            {
              label: data.kind === 'ip' ? 'Organisation' : 'Registrar',
              value:
                data.registrar ??
                data.entities.find((e) => e.roles.includes('registrant'))?.name,
            },
            ...(data.queried !== data.name?.toLowerCase()
              ? [{ label: 'Queried', value: data.queried }]
              : []),
            ...(daysLeft !== undefined
              ? [
                  {
                    label: 'Expires in',
                    value: (
                      <span
                        className={
                          daysLeft < 30
                            ? 'text-neon-magenta'
                            : 'text-neon-green'
                        }
                      >
                        {daysLeft} days
                      </span>
                    ),
                  },
                ]
              : []),
            ...(data.network
              ? [
                  {
                    label: 'Range',
                    value:
                      data.network.startAddress &&
                      `${data.network.startAddress} - ${data.network.endAddress}`,
                  },
                  { label: 'CIDR', value: data.network.cidr?.join(', ') },
                  { label: 'Country', value: data.network.country },
                  { label: 'Allocation', value: data.network.type },
                ]
              : []),
          ]}
        />
      </Panel>

      <Panel title="Lifecycle">
        <ol className="space-y-2 border-l border-border pl-4">
          {data.events.map((e) => (
            <li key={`${e.action}-${e.date}`} className="relative text-sm">
              <span className="absolute top-1.5 -left-[21px] size-2 bg-primary shadow-[0_0_8px] shadow-primary" />
              <Tag tone={EVENT_TONE[e.action] ?? 'cyan'}>{e.action}</Tag>
              <span className="ml-2">{formatDate(e.date)}</span>
            </li>
          ))}
          {data.events.length === 0 && (
            <li className="text-sm text-muted-foreground">No events</li>
          )}
        </ol>
      </Panel>

      <Panel title="Status & nameservers">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1">
            {data.status.map((s) => (
              <Tag key={s} tone="magenta">
                {s}
              </Tag>
            ))}
            {data.status.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No status flags
              </span>
            )}
          </div>
          <ul className="space-y-1 text-sm">
            {data.nameservers.map((ns) => (
              <li key={ns} className="flex items-center justify-between gap-2">
                <code>{ns}</code>
                <PivotLinks value={ns} exclude="whois" />
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      {data.entities.length > 0 && (
        <Panel title="Entities" className="lg:col-span-2" bodyClassName="p-0">
          <ul className="divide-y divide-border text-sm">
            {data.entities.map((e, i) => (
              <li
                key={`${e.handle}-${i}`}
                className="flex flex-wrap items-center gap-2 px-4 py-2"
              >
                {e.roles.map((r) => (
                  <Tag key={r} tone="muted">
                    {r}
                  </Tag>
                ))}
                <span>
                  {e.name ?? (
                    <span className="text-muted-foreground/60">redacted</span>
                  )}
                </span>
                {e.handle && (
                  <span className="text-xs text-muted-foreground">
                    #{e.handle}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="text-xs text-muted-foreground lg:col-span-2">
        source: {data.source}
      </p>
    </div>
  );
}
