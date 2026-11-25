import { dbmToQuality, type WifiNetwork, type WifiOutput } from '@recon/shared';
import {
  DiscoveryRadar,
  type Discovery,
  type RadarGroup,
} from '@/components/tool';
import { securityTone } from './group-networks';

const GROUPS: RadarGroup[] = [
  { id: 'magenta', label: 'Open / WEP', tone: 'magenta' },
  { id: 'yellow', label: 'WPA', tone: 'yellow' },
  { id: 'cyan', label: 'WPA2', tone: 'cyan' },
  { id: 'green', label: 'WPA3 / OWE', tone: 'green' },
  { id: 'muted', label: 'Other', tone: 'muted' },
];

export function wifiDiscovery(
  networks: WifiNetwork[],
  host: string,
): Discovery {
  return {
    center: host,
    groups: GROUPS,
    blips: networks.map((n, i) => {
      const quality =
        n.quality ??
        (n.signalDbm !== undefined ? dbmToQuality(n.signalDbm) : undefined);
      const name = n.redacted
        ? '<redacted>'
        : n.hidden || !n.ssid
          ? '(hidden)'
          : n.ssid;
      return {
        id: n.bssid ?? `${name}:${n.channel ?? ''}:${i}`,
        label: n.current ? `${name} (connected)` : name,
        group: securityTone(n.security),
        distance: quality === undefined ? 1 : 1 - quality / 100,
        detail: [
          n.security,
          n.band && `${n.band}${n.channel ? ` ch ${n.channel}` : ''}`,
          n.signalDbm !== undefined && `${n.signalDbm} dBm`,
          n.bssid,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    }),
  };
}

/** Access points around the API host; the closer to the centre, the stronger the signal. */
export function WifiRadar({ data, host }: { data: WifiOutput; host: string }) {
  return (
    <DiscoveryRadar
      {...wifiDiscovery(data.networks, host)}
      title="Airspace radar"
      tool="wifi"
      distanceHint="Distance from the centre shows signal strength: closer is stronger."
    />
  );
}
