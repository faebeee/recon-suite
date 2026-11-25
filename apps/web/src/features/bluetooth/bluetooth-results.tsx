import {
  AlertTriangle,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  ChevronRight,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  BluetoothDevice,
  BluetoothOutput,
  BluetoothTransport,
} from '@recon/shared';
import { KeyValueGrid, Meter, Panel, Segmented, Tag } from '@/components/cyber';
import { HostNoticePanel, IntelViewExportButton } from '@/components/tool';
import { cn } from '@/lib/utils';
import { toneText, type Tone } from '@/lib/tones';
import { bluetoothDiscovery } from './bluetooth-radar';

type Filter = 'all' | BluetoothTransport;

const TRANSPORT_LABEL: Record<BluetoothTransport, string> = {
  ble: 'BLE',
  classic: 'Classic',
  unknown: 'Paired',
};
const TRANSPORT_TONE: Record<BluetoothTransport, Tone> = {
  ble: 'cyan',
  classic: 'magenta',
  unknown: 'muted',
};

function qualityTone(q: number | undefined): Tone {
  if (q === undefined) return 'muted';
  if (q >= 60) return 'green';
  if (q >= 30) return 'yellow';
  return 'magenta';
}

export function BluetoothResults({
  data,
  host,
}: {
  data: BluetoothOutput;
  host: string;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [namedOnly, setNamedOnly] = useState(false);

  const count = (t: BluetoothTransport) =>
    data.devices.filter((d) => d.transport === t).length;
  const filters = (['all', 'ble', 'classic', 'unknown'] as const)
    .filter((f) => f === 'all' || count(f) > 0)
    .map((value) => ({
      value: value as Filter,
      label: value === 'all' ? 'All' : TRANSPORT_LABEL[value],
    }));

  const devices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.devices.filter(
      (d) =>
        (filter === 'all' || d.transport === filter) &&
        (!namedOnly || d.name) &&
        (!q ||
          [d.name, d.id, d.manufacturer, d.deviceClass].some((v) =>
            v?.toLowerCase().includes(q),
          )),
    );
  }, [data.devices, filter, query, namedOnly]);

  return (
    <div className="space-y-4">
      {data.notice && (
        <HostNoticePanel title="Limited result" notice={data.notice} />
      )}
      {data.warnings?.map((w) => (
        <p key={w} className="flex items-start gap-2 text-xs text-neon-yellow">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {w}
        </p>
      ))}

      <Panel title="Airspace">
        <KeyValueGrid
          className="lg:grid-cols-4"
          items={[
            { label: 'Devices', value: data.devices.length },
            { label: 'BLE', value: count('ble') },
            { label: 'Classic', value: count('classic') },
            {
              label: 'Named',
              value: data.devices.filter((d) => d.name).length,
            },
            { label: 'Duration', value: `${data.durationSec}s` },
            { label: 'Platform', value: data.platform },
            {
              label: 'Method',
              value: <code className="text-xs">{data.method}</code>,
            },
          ]}
        />
        {data.platform === 'macos' && count('ble') > 0 && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            macOS hides BLE MAC addresses; BLE devices are identified by a
            per-host UUID. Many devices also rotate random addresses, so one
            physical device can appear more than once.
          </p>
        )}
      </Panel>

      <Panel
        title={`${devices.length} devices`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <IntelViewExportButton
              tool="bluetooth"
              discovery={bluetoothDiscovery(devices, host)}
            />
            {filters.length > 2 && (
              <Segmented
                label="Transport filter"
                options={filters}
                value={filter}
                onChange={setFilter}
              />
            )}
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter by name, id, vendor…"
            aria-label="Filter devices"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <label className="flex items-center gap-2 text-[11px] tracking-wider text-muted-foreground uppercase">
            <input
              type="checkbox"
              checked={namedOnly}
              onChange={(e) => setNamedOnly(e.target.checked)}
              className="accent-[var(--neon-cyan)]"
            />
            Named only
          </label>
        </div>
        {devices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No devices match.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {devices.map((d) => (
              <DeviceRow key={`${d.transport}-${d.id}`} device={d} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function DeviceRow({ device: d }: { device: BluetoothDevice }) {
  const [open, setOpen] = useState(false);
  const Icon = d.connected
    ? BluetoothConnected
    : d.discovered
      ? Bluetooth
      : BluetoothOff;

  return (
    <li
      className={cn(
        d.connected && 'bg-primary/5',
        !d.discovered && 'opacity-70',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left hover:bg-card"
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
        />
        <Icon
          className={cn(
            'size-5 shrink-0',
            toneText[d.discovered ? qualityTone(d.quality) : 'muted'],
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {d.name ?? (
            <span className="font-normal text-muted-foreground italic">
              unnamed
            </span>
          )}
        </span>
        <Tag tone={TRANSPORT_TONE[d.transport]}>
          {TRANSPORT_LABEL[d.transport]}
        </Tag>
        {d.manufacturer && <Tag tone="muted">{d.manufacturer}</Tag>}
        {d.deviceClass && <Tag tone="muted">{d.deviceClass}</Tag>}
        {d.connected && <Tag tone="green">connected</Tag>}
        {d.paired && !d.connected && <Tag tone="muted">paired</Tag>}
        <span className="flex w-36 items-center gap-2">
          {d.rssi !== undefined ? (
            <>
              <span className="flex-1">
                <Meter
                  value={d.quality ?? 0}
                  tone={qualityTone(d.quality)}
                  segments={10}
                />
              </span>
              <span className="w-16 text-right text-[11px] text-muted-foreground tabular-nums">
                {d.rssi} dBm
              </span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">
              {d.discovered ? 'no RSSI' : 'not scanned'}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="border-t border-border bg-background/40 px-4 py-3 pl-12">
          <KeyValueGrid
            className="lg:grid-cols-3"
            items={[
              {
                label: d.address ? 'Address' : 'Identifier',
                value: (
                  <code className="text-xs break-all">{d.address ?? d.id}</code>
                ),
              },
              { label: 'Transport', value: TRANSPORT_LABEL[d.transport] },
              {
                label: 'Seen in scan',
                value: d.discovered ? 'yes' : 'no (known/paired)',
              },
              {
                label: 'Connectable',
                value:
                  d.connectable === undefined
                    ? undefined
                    : d.connectable
                      ? 'yes'
                      : 'no',
              },
              {
                label: 'TX power',
                value: d.txPower !== undefined ? `${d.txPower} dBm` : undefined,
              },
              {
                label: 'Manufacturer',
                value:
                  d.manufacturerId !== undefined
                    ? `${d.manufacturer} (0x${d.manufacturerId.toString(16).padStart(4, '0')})`
                    : undefined,
              },
              { label: 'Class', value: d.deviceClass },
              {
                label: 'Services',
                value: d.services?.length ? (
                  <code className="text-xs break-all">
                    {d.services.join(', ')}
                  </code>
                ) : undefined,
              },
            ]}
          />
        </div>
      )}
    </li>
  );
}
