import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type {
  ConnectivityCheck,
  HostInterface,
  HostStats,
  InternetStatus,
} from '@recon/shared';
import { CopyButton, Meter, Panel, StatusDot, Tag } from '@/components/cyber';
import { formatBytes, formatDuration } from '@/lib/format';
import { LOCATION_META } from '@/lib/runtime';
import { toneText, type Tone } from '@/lib/tones';
import { cn } from '@/lib/utils';
import { hostStatsQuery } from './host-query';

const INTERNET_TONE: Record<InternetStatus, Tone> = {
  online: 'green',
  degraded: 'yellow',
  offline: 'magenta',
};

const label = 'text-[10px] tracking-[0.2em] text-muted-foreground uppercase';

/** Dashboard panel: internet connection, network (IP, MAC, gateway) and host resources. */
export function HostPanel() {
  const { data, isError, error } = useQuery(hostStatsQuery);

  if (isError) {
    return (
      <Panel title="Host" tone="magenta">
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </Panel>
    );
  }
  if (!data) {
    return (
      <Panel title="Host">
        <p className="text-sm text-muted-foreground">Reading host…</p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Host"
      actions={
        <span className="flex min-w-0 items-center gap-2 text-[11px] tracking-wider text-muted-foreground uppercase">
          <span className="truncate normal-case">{data.hostname}</span>
          <Tag tone={LOCATION_META[data.location].tone}>
            {LOCATION_META[data.location].label}
          </Tag>
          <Link to="/system" className="hover:text-primary">
            details
          </Link>
        </span>
      }
    >
      {data.location === 'container' && (
        <p className="mb-4 text-xs text-neon-yellow">
          The API runs in a container: addresses and gateway are the
          container's, not your machine's.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <InternetSection internet={data.internet} />
        <NetworkSection network={data.network} />
        <ResourcesSection data={data} />
      </div>
    </Panel>
  );
}

function InternetSection({ internet }: { internet: HostStats['internet'] }) {
  const tone = INTERNET_TONE[internet.status];
  return (
    <section className="min-w-0 space-y-3" aria-label="Internet connection">
      <p className={label}>Internet</p>
      <p
        className={cn(
          'flex items-center gap-2 font-display text-lg font-bold tracking-[0.15em] uppercase',
          toneText[tone],
        )}
      >
        <StatusDot tone={tone} pulse={internet.status === 'online'} />
        {internet.status}
      </p>
      <dl className="space-y-1.5 text-xs">
        <Row term="Public IP">
          {internet.publicIp ? (
            <span className="flex items-center gap-1">
              <span className="font-semibold">{internet.publicIp}</span>
              <CopyButton
                value={internet.publicIp}
                label="Copy public IP"
                iconOnly
              />
            </span>
          ) : undefined}
        </Row>
        <Row term="Location">
          {[internet.country, internet.colo && `via ${internet.colo}`]
            .filter(Boolean)
            .join(' ') || undefined}
        </Row>
        <Row term="DNS">
          <Check check={internet.dns} />
        </Row>
        <Row term="HTTPS">
          <Check check={internet.https} />
        </Row>
      </dl>
    </section>
  );
}

function NetworkSection({ network }: { network: HostStats['network'] }) {
  return (
    <section className="min-w-0 space-y-3" aria-label="Network">
      <p className={label}>Network</p>
      <dl className="space-y-1.5 text-xs">
        <Row term="Gateway">
          {network.defaultGateway
            ? `${network.defaultGateway.address}${network.defaultGateway.interface ? ` (${network.defaultGateway.interface})` : ''}`
            : undefined}
        </Row>
        <Row term="DNS servers">
          {network.dnsServers.length
            ? network.dnsServers.join(', ')
            : undefined}
        </Row>
      </dl>
      {network.interfaces.length ? (
        <ul className="space-y-2">
          {network.interfaces.map((i) => (
            <InterfaceRow key={i.name} iface={i} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No network interfaces.</p>
      )}
    </section>
  );
}

function InterfaceRow({ iface }: { iface: HostInterface }) {
  // Global addresses first; link-local IPv6 is rarely what you are looking for.
  const addresses = [...iface.addresses].sort(
    (a, b) =>
      a.family - b.family ||
      Number(a.address.startsWith('fe80')) -
        Number(b.address.startsWith('fe80')),
  );
  return (
    <li
      className={cn(
        'border-l-2 pl-2 text-xs',
        iface.isDefault ? 'border-primary' : 'border-border',
      )}
    >
      <p className="flex items-center gap-2">
        <span className="font-semibold">{iface.name}</span>
        {iface.isDefault && <Tag tone="cyan">default</Tag>}
        {iface.mac && (
          <span className="text-muted-foreground" title="MAC address">
            {iface.mac}
          </span>
        )}
      </p>
      {addresses.map((a) => (
        <p key={a.cidr} className="break-all text-muted-foreground">
          <span className={cn(a.family === 4 && 'text-foreground')}>
            {a.cidr}
          </span>
        </p>
      ))}
    </li>
  );
}

function ResourcesSection({ data }: { data: HostStats }) {
  const used = data.memory.totalBytes - data.memory.freeBytes;
  const usedPct = data.memory.totalBytes
    ? Math.round((used / data.memory.totalBytes) * 100)
    : 0;
  const load = data.loadAverage[0];
  const loadPct = data.cpu.cores
    ? Math.round((load / data.cpu.cores) * 100)
    : 0;
  return (
    <section className="min-w-0 space-y-3" aria-label="System resources">
      <p className={label}>System</p>
      <dl className="space-y-1.5 text-xs">
        <Row term="OS">
          {data.os.platform} {data.os.release} ({data.os.arch})
        </Row>
        <Row term="CPU">
          <span title={data.cpu.model}>
            {data.cpu.cores} × {data.cpu.model}
          </span>
        </Row>
        <Row term="Uptime">{formatDuration(data.uptimeSeconds)}</Row>
      </dl>
      <div className="space-y-1">
        <p className="flex justify-between text-xs">
          <span className={label}>Memory</span>
          <span>
            {formatBytes(used)} / {formatBytes(data.memory.totalBytes)}
          </span>
        </p>
        <Meter value={usedPct} tone={meterTone(usedPct)} />
      </div>
      <div className="space-y-1">
        <p className="flex justify-between text-xs">
          <span className={label}>Load</span>
          <span title="1, 5 and 15 minute averages">
            {data.loadAverage.map((l) => l.toFixed(2)).join(' · ')}
          </span>
        </p>
        <Meter value={loadPct} tone={meterTone(loadPct)} />
      </div>
    </section>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0 break-words">
        {children ?? <span className="text-muted-foreground/60">-</span>}
      </dd>
    </div>
  );
}

function Check({ check }: { check: ConnectivityCheck }) {
  return check.ok ? (
    <span className="text-neon-green">
      ok{check.ms !== undefined && ` · ${check.ms} ms`}
    </span>
  ) : (
    <span className="text-neon-magenta" title={check.error}>
      failed{check.error && `: ${check.error}`}
    </span>
  );
}

function meterTone(pct: number): Tone {
  return pct >= 90 ? 'magenta' : pct >= 70 ? 'yellow' : 'green';
}
