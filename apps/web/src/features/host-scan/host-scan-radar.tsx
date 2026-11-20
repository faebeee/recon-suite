import type { HostScanOutput } from '@recon/shared';
import { DiscoveryRadar } from '@/components/tool';

const GROUPS = [
  { id: 'vendor', label: 'Vendor known', tone: 'cyan' as const },
  { id: 'unknown', label: 'Vendor unknown', tone: 'muted' as const },
];

export function HostScanRadar({ data }: { data: HostScanOutput }) {
  return (
    <DiscoveryRadar
      center={`${data.interface} · ${data.network}`}
      blips={data.hosts.map((h) => ({
        id: h.ip,
        label: h.ip,
        group: h.vendor ? 'vendor' : 'unknown',
        detail:
          [h.vendor, h.macAddress].filter(Boolean).join(' · ') || undefined,
        pivot: h.ip,
      }))}
      groups={GROUPS}
      exclude="host-scan"
    />
  );
}
