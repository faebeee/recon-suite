import type { ReverseIpOutput } from '@recon/shared';
import { DiscoveryRadar } from '@/components/tool';

const GROUPS = [
  { id: 'cohosted', label: 'Co-hosted domains', tone: 'cyan' as const },
];

export function ReverseIpRadar({ data }: { data: ReverseIpOutput }) {
  return (
    <DiscoveryRadar
      center={data.resolvedFrom ? `${data.ip} (${data.resolvedFrom})` : data.ip}
      blips={data.domains.map((d) => ({
        id: d,
        label: d,
        group: 'cohosted',
        tone: d === data.resolvedFrom ? 'green' : undefined,
        pivot: d,
      }))}
      groups={GROUPS}
      exclude="reverse-ip"
    />
  );
}
