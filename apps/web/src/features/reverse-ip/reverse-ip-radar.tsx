import type { ReverseIpOutput } from '@recon/shared';
import { DiscoveryRadar, type Discovery } from '@/components/tool';

const GROUPS = [
  { id: 'cohosted', label: 'Co-hosted domains', tone: 'cyan' as const },
];

export function reverseIpDiscovery(
  data: ReverseIpOutput,
  domains: string[] = data.domains,
): Discovery {
  return {
    center: data.resolvedFrom ? `${data.ip} (${data.resolvedFrom})` : data.ip,
    groups: GROUPS,
    blips: domains.map((d) => ({
      id: d,
      label: d,
      group: 'cohosted',
      tone: d === data.resolvedFrom ? 'green' : undefined,
      pivot: d,
    })),
  };
}

export function ReverseIpRadar({ data }: { data: ReverseIpOutput }) {
  return <DiscoveryRadar {...reverseIpDiscovery(data)} exclude="reverse-ip" />;
}
