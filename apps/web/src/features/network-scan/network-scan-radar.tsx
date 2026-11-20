import type { NetworkScanOutput } from '@recon/shared';
import { DiscoveryRadar, type RadarGroup } from '@/components/tool';

const UNKNOWN = 'Unknown device';

export function NetworkScanRadar({ data }: { data: NetworkScanOutput }) {
  const kinds = [
    ...new Set(data.hosts.map((h) => h.deviceGuess ?? UNKNOWN)),
  ].sort(
    (a, b) =>
      Number(a === UNKNOWN) - Number(b === UNKNOWN) || a.localeCompare(b),
  );
  const groups: RadarGroup[] = kinds.map((k) => ({
    id: k,
    label: k,
    tone: k === UNKNOWN ? 'muted' : 'cyan',
  }));
  return (
    <DiscoveryRadar
      center={data.network}
      blips={data.hosts.map((h) => ({
        id: h.ip,
        label: h.ip,
        group: h.deviceGuess ?? UNKNOWN,
        detail:
          [h.vendor, h.macAddress].filter(Boolean).join(' · ') || undefined,
        pivot: h.ip,
      }))}
      groups={groups}
      exclude="network-scan"
    />
  );
}
