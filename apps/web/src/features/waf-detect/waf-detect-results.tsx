import type { EdgeKind, WafDetectOutput } from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import type { Tone } from '@/lib/tones';

const KIND_TONE: Record<EdgeKind, Tone> = {
  cdn: 'cyan',
  waf: 'yellow',
  platform: 'muted',
};

export function WafDetectResults({ data }: { data: WafDetectOutput }) {
  return (
    <div className="grid gap-4">
      <Panel title="Edge" bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Final URL
          </span>
          <code className="min-w-0 flex-1 truncate" title={data.finalUrl}>
            {data.finalUrl}
          </code>
          <PivotLinks value={data.finalUrl} exclude="waf-detect" />
        </div>
        {data.detections.length ? (
          <ul className="divide-y divide-border">
            {data.detections.map((d) => (
              <li key={d.name} className="space-y-1 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{d.name}</span>
                  {d.kinds.map((k) => (
                    <Tag key={k} tone={KIND_TONE[k]}>
                      {k}
                    </Tag>
                  ))}
                  {d.probeOnly && <Tag tone="muted">block page only</Tag>}
                </div>
                <p className="text-xs break-words text-muted-foreground">
                  {d.evidence.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No known CDN, WAF or hosting edge recognised.
          </p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Requests">
          <KeyValueGrid
            items={[
              { label: 'Normal status', value: data.baseline.status },
              { label: 'Server header', value: data.baseline.server },
              {
                label: 'Trigger status',
                value: data.probe
                  ? (data.probe.status ?? data.probe.error)
                  : 'not sent',
              },
              {
                label: 'Blocked',
                value: data.probe ? (
                  <Tag tone={data.probe.blocked ? 'green' : 'muted'}>
                    {data.probe.blocked ? 'yes' : 'no'}
                  </Tag>
                ) : undefined,
              },
            ]}
          />
        </Panel>
        <Panel title="Findings" bodyClassName="p-0">
          <FindingsList findings={data.findings} />
        </Panel>
      </div>
    </div>
  );
}
