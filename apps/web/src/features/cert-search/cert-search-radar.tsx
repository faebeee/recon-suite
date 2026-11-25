import type { CertSearchOutput } from '@recon/shared';
import {
  DiscoveryRadar,
  type Discovery,
  type RadarBlip,
} from '@/components/tool';

const GROUPS = [
  { id: 'apex', label: 'Apex domains', tone: 'cyan' as const },
  { id: 'host', label: 'Hostnames', tone: 'green' as const },
  { id: 'wildcard', label: 'Wildcards', tone: 'yellow' as const },
];

export function certSearchDiscovery(
  data: CertSearchOutput,
  domains: CertSearchOutput['domains'] = data.domains,
): Discovery {
  const apex = new Set(data.apexDomains);
  const blips: RadarBlip[] = domains.map((d) => ({
    id: d.name,
    label: d.name,
    group: d.wildcard ? 'wildcard' : apex.has(d.name) ? 'apex' : 'host',
    detail: `${d.certificates} certificate${d.certificates === 1 ? '' : 's'}, last seen ${d.lastSeen.slice(0, 10)}`,
    pivot: d.name.replace(/^\*\./, ''),
  }));
  // Apex domains first, so they survive the blip cap.
  blips.sort((a, b) => Number(b.group === 'apex') - Number(a.group === 'apex'));
  return { center: data.organisation, groups: GROUPS, blips };
}

export function CertSearchRadar({ data }: { data: CertSearchOutput }) {
  return (
    <DiscoveryRadar {...certSearchDiscovery(data)} exclude="cert-search" />
  );
}
