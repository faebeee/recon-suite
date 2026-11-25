import type { HostScanOutput } from '@recon/shared';
import { CopyButton, KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { IntelViewExportButton, PivotLinks } from '@/components/tool';
import { hostScanDiscovery } from './host-scan-radar';

export function HostScanResults({ data }: { data: HostScanOutput }) {
  return (
    <div className="space-y-4">
      <Panel title="Scan">
        <KeyValueGrid
          className="lg:grid-cols-4"
          items={[
            { label: 'Interface', value: data.interface },
            {
              label: 'Network',
              value: data.limitedFrom ? (
                <span className="flex flex-col gap-0.5">
                  <span>{data.network}</span>
                  <span className="text-[11px] text-muted-foreground">
                    part of {data.limitedFrom} (too large to sweep whole)
                  </span>
                </span>
              ) : (
                data.network
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

      <Panel
        title={`${data.hosts.length} hosts`}
        actions={
          <IntelViewExportButton
            tool="host-scan"
            discovery={hostScanDiscovery(data)}
          />
        }
        bodyClassName="p-0"
      >
        {data.hosts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No hosts responded to the nmap host sweep.
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
                <CopyButton value={h.ip} />
                <PivotLinks value={h.ip} exclude="host-scan" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
