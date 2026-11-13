import type { TakeoverOutput, TakeoverStatus } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import { cn } from '@/lib/utils';
import { toneText, type Tone } from '@/lib/tones';

const STATUS_TONE: Record<TakeoverStatus, Tone> = {
  vulnerable: 'magenta',
  likely: 'yellow',
  unknown: 'cyan',
  safe: 'green',
};
const ORDER: TakeoverStatus[] = ['vulnerable', 'likely', 'unknown', 'safe'];

export function TakeoverResults({ data }: { data: TakeoverOutput }) {
  const counts = Object.fromEntries(
    ORDER.map((s) => [s, data.candidates.filter((c) => c.status === s).length]),
  ) as Record<TakeoverStatus, number>;
  const candidates = [...data.candidates].sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      a.host.localeCompare(b.host),
  );

  return (
    <div className="grid gap-4">
      <Panel title="Summary">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Hosts checked" value={data.checked} tone="cyan" />
          <Stat label="With CNAME" value={data.candidates.length} tone="cyan" />
          {ORDER.map((s) => (
            <Stat
              key={s}
              label={s}
              value={counts[s]}
              tone={counts[s] ? STATUS_TONE[s] : 'muted'}
            />
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Source:{' '}
          {data.source === 'ct'
            ? 'certificate transparency (crt.sh) + your hosts'
            : 'your list'}
        </p>
      </Panel>

      <Panel title={`Candidates (${candidates.length})`} bodyClassName="p-0">
        {candidates.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No host has a CNAME record
          </p>
        ) : (
          <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto text-sm">
            {candidates.map((c) => (
              <li key={c.host} className="space-y-1 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Tag tone={STATUS_TONE[c.status]}>{c.status}</Tag>
                  <span className="min-w-0 font-semibold break-all">
                    {c.host}
                  </span>
                  {c.provider && <Tag tone="muted">{c.provider}</Tag>}
                  {c.dangling && <Tag tone="yellow">NXDOMAIN</Tag>}
                  <PivotLinks
                    value={c.host}
                    exclude="takeover"
                    className="ml-auto"
                  />
                </div>
                {c.cname.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                    <span>CNAME</span>
                    {c.cname.map((hop, i) => (
                      <span
                        key={`${hop}-${i}`}
                        className="inline-flex items-center gap-1"
                      >
                        <span aria-hidden>{'->'}</span>
                        <code className="break-all text-foreground/80">
                          {hop}
                        </code>
                        {i === c.cname.length - 1 && !c.dangling && (
                          <PivotLinks value={hop} exclude="takeover" />
                        )}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{c.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Findings" bodyClassName="p-0">
        <FindingsList findings={data.findings} />
      </Panel>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: Tone;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'font-dot text-2xl font-black tabular-nums',
          toneText[tone],
        )}
      >
        {value}
      </dd>
    </div>
  );
}
