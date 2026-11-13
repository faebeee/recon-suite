import type { NetworkScanOutput } from '@recon/shared';
import { CopyButton, KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList } from '@/components/tool';
import { PivotLinks } from '@/components/tool';

export function NetworkScanResults({ data }: { data: NetworkScanOutput }) {
  return (
    <div className="space-y-4">
      <Panel title="Scan">
        <KeyValueGrid
          className="lg:grid-cols-4"
          items={[
            { label: 'Network', value: data.network },
            {
              label: 'Runner',
              value: (
                <Tag tone={data.runner === 'kali' ? 'cyan' : 'muted'}>
                  {data.runner === 'kali' ? 'kali container' : 'api host'}
                </Tag>
              ),
            },
            { label: 'Hosts found', value: data.hosts.length },
            {
              label: 'Method',
              value: <code className="text-xs">{data.method}</code>,
            },
          ]}
        />
      </Panel>

      <Panel title={`${data.hosts.length} hosts`} bodyClassName="p-0">
        {data.hosts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No hosts responded to the ping sweep.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.hosts.map((h) => (
              <li
                key={h.ip}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
              >
                <span className="min-w-0 flex-1 font-mono text-sm font-semibold">
                  {h.ip}
                </span>
                {h.macAddress && <Tag tone="muted">{h.macAddress}</Tag>}
                {h.vendor && <Tag tone="cyan">{h.vendor}</Tag>}
                {h.deviceGuess && <Tag tone="green">{h.deviceGuess}</Tag>}
                <CopyButton value={h.ip} />
                <PivotLinks value={h.ip} exclude="network-scan" />
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
