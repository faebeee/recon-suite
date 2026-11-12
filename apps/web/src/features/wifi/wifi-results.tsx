import { ChevronRight, Wifi, WifiHigh, WifiLow, WifiZero } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WifiBand, WifiNetwork, WifiOutput } from '@recon/shared';
import { KeyValueGrid, Meter, Panel, Segmented, Tag } from '@/components/cyber';
import { HostNoticePanel } from '@/components/tool';
import { cn } from '@/lib/utils';
import { toneText, type Tone } from '@/lib/tones';
import {
  groupNetworks,
  isInsecure,
  securityTone,
  type WifiGroup,
} from './group-networks';

type BandFilter = 'all' | WifiBand;
const BAND_FILTERS: { value: BandFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '2.4 GHz', label: '2.4 GHz' },
  { value: '5 GHz', label: '5 GHz' },
  { value: '6 GHz', label: '6 GHz' },
];

function qualityTone(q: number | undefined): Tone {
  if (q === undefined) return 'muted';
  if (q >= 60) return 'green';
  if (q >= 35) return 'yellow';
  return 'magenta';
}

function SignalIcon({ quality }: { quality?: number }) {
  const Icon =
    quality === undefined
      ? WifiZero
      : quality >= 70
        ? Wifi
        : quality >= 40
          ? WifiHigh
          : WifiLow;
  return (
    <Icon
      className={cn('size-5 shrink-0', toneText[qualityTone(quality)])}
      aria-hidden
    />
  );
}

export function WifiResults({ data }: { data: WifiOutput }) {
  const [band, setBand] = useState<BandFilter>('all');
  const networks = useMemo(
    () =>
      band === 'all'
        ? data.networks
        : data.networks.filter((n) => n.band === band),
    [data.networks, band],
  );
  const groups = useMemo(() => groupNetworks(networks), [networks]);
  const allGroups = useMemo(
    () => groupNetworks(data.networks),
    [data.networks],
  );
  const insecure = allGroups.filter((g) => isInsecure(g.security)).length;
  const countBand = (b: WifiBand) =>
    data.networks.filter((n) => n.band === b).length;

  return (
    <div className="space-y-4">
      {data.redaction && (
        <HostNoticePanel title="Names redacted" notice={data.redaction} />
      )}

      <Panel title="Spectrum">
        <KeyValueGrid
          className="lg:grid-cols-4"
          items={[
            { label: 'Networks', value: allGroups.length },
            { label: 'Access points / radios', value: data.networks.length },
            {
              label: 'Open / WEP',
              value: (
                <span
                  className={insecure ? 'text-neon-magenta' : 'text-neon-green'}
                >
                  {insecure}
                </span>
              ),
            },
            {
              label: 'Bands',
              value: `2.4: ${countBand('2.4 GHz')} · 5: ${countBand('5 GHz')} · 6: ${countBand('6 GHz')}`,
            },
            { label: 'Interface', value: data.interface },
            { label: 'Platform', value: data.platform },
            {
              label: 'Method',
              value: <code className="text-xs">{data.method}</code>,
            },
          ]}
        />
        {data.platform === 'macos' && !data.redaction && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            macOS reports signal strength only for some networks.
          </p>
        )}
      </Panel>

      <Panel
        title={`${groups.length} networks`}
        actions={
          <Segmented
            label="Band filter"
            options={BAND_FILTERS}
            value={band}
            onChange={setBand}
          />
        }
        bodyClassName="p-0"
      >
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No networks visible{band !== 'all' && ` on ${band}`}.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {groups.map((g) => (
              <NetworkRow key={g.key} group={g} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function NetworkRow({ group: g }: { group: WifiGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cn(g.current && 'bg-primary/5')}>
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
        <SignalIcon quality={g.bestQuality} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {g.redacted ? (
            <span className="text-muted-foreground italic">
              name redacted by OS
            </span>
          ) : g.hidden ? (
            <span className="text-muted-foreground italic">hidden network</span>
          ) : (
            g.ssid
          )}
        </span>
        {g.current && <Tag tone="green">connected</Tag>}
        <Tag tone={securityTone(g.security)}>{g.security}</Tag>
        {g.bands.map((b) => (
          <Tag key={b} tone="muted">
            {b}
          </Tag>
        ))}
        <span className="w-14 text-right text-[11px] text-muted-foreground">
          {g.accessPoints.length}{' '}
          {g.accessPoints.length === 1 ? 'radio' : 'radios'}
        </span>
        <span className="flex w-32 items-center gap-2">
          {g.bestQuality !== undefined ? (
            <>
              <span className="flex-1">
                <Meter
                  value={g.bestQuality}
                  tone={qualityTone(g.bestQuality)}
                  segments={10}
                />
              </span>
              <span className="w-14 text-right text-[11px] text-muted-foreground tabular-nums">
                {g.bestSignalDbm !== undefined
                  ? `${g.bestSignalDbm} dBm`
                  : `${g.bestQuality}%`}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">
              no signal data
            </span>
          )}
        </span>
      </button>
      {open && <AccessPoints aps={g.accessPoints} />}
    </li>
  );
}

function AccessPoints({ aps }: { aps: WifiNetwork[] }) {
  return (
    <div className="overflow-x-auto border-t border-border bg-background/40 px-4 py-2 pl-12">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            <th className="py-1 pr-4 font-normal">Band</th>
            <th className="py-1 pr-4 font-normal">Channel</th>
            <th className="py-1 pr-4 font-normal">Width</th>
            <th className="py-1 pr-4 font-normal">PHY</th>
            <th className="py-1 pr-4 font-normal">Signal</th>
            <th className="py-1 font-normal">BSSID</th>
          </tr>
        </thead>
        <tbody>
          {aps.map((ap, i) => (
            <tr
              key={`${ap.bssid ?? ''}-${ap.channel}-${i}`}
              className="border-t border-border/50"
            >
              <td className="py-1.5 pr-4">{ap.band ?? '-'}</td>
              <td className="py-1.5 pr-4">{ap.channel ?? '-'}</td>
              <td className="py-1.5 pr-4">
                {ap.channelWidthMhz ? `${ap.channelWidthMhz} MHz` : '-'}
              </td>
              <td className="py-1.5 pr-4">{ap.phyMode ?? '-'}</td>
              <td
                className={cn(
                  'py-1.5 pr-4 tabular-nums',
                  toneText[qualityTone(ap.quality)],
                )}
              >
                {ap.signalDbm !== undefined
                  ? `${ap.signalDbm} dBm${ap.noiseDbm !== undefined ? ` / ${ap.noiseDbm}` : ''}`
                  : ap.quality !== undefined
                    ? `${ap.quality}%`
                    : '-'}
              </td>
              <td className="py-1.5 text-muted-foreground">
                {ap.bssid ?? (ap.redacted ? 'redacted by OS' : '-')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
