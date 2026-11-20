import type { TakeoverOutput, TakeoverStatus } from '@recon/shared';
import { DiscoveryRadar, type RadarGroup } from '@/components/tool';

const GROUPS: (RadarGroup & { id: TakeoverStatus })[] = [
  { id: 'vulnerable', label: 'Vulnerable', tone: 'magenta' },
  { id: 'likely', label: 'Likely', tone: 'yellow' },
  { id: 'unknown', label: 'Unknown', tone: 'muted' },
  { id: 'safe', label: 'Safe', tone: 'green' },
];

export function TakeoverRadar({ data }: { data: TakeoverOutput }) {
  return (
    <DiscoveryRadar
      center={data.domain}
      blips={data.candidates.map((c) => ({
        id: c.host,
        label: c.host,
        group: c.status,
        detail: [c.cname.length && `CNAME ${c.cname.join(' → ')}`, c.reason]
          .filter(Boolean)
          .join(' · '),
        pivot: c.host,
      }))}
      groups={GROUPS}
      exclude="takeover"
    />
  );
}
