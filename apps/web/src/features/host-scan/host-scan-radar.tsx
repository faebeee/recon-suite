import type { HostScanOutput } from '@recon/shared';
import { DiscoveryRadar, type Discovery } from '@/components/tool';

const GROUPS = [
  { id: 'vendor', label: 'Vendor known', tone: 'cyan' as const },
  { id: 'unknown', label: 'Vendor unknown', tone: 'muted' as const },
];

export function hostScanDiscovery(data: HostScanOutput): Discovery {
  return {
    center: `${data.interface} · ${data.network}`,
    groups: GROUPS,
    blips: data.hosts.map((h) => ({
      id: h.ip,
      label: h.ip,
      group: h.vendor ? 'vendor' : 'unknown',
      detail: [h.vendor, h.macAddress].filter(Boolean).join(' · ') || undefined,
      pivot: h.ip,
    })),
  };
}

export function HostScanRadar({ data }: { data: HostScanOutput }) {
  return <DiscoveryRadar {...hostScanDiscovery(data)} exclude="host-scan" />;
}
