import type { CertSearchOutput } from '@recon/shared';
import { DiscoveryRadar, type RadarBlip } from '@/components/tool';

const GROUPS = [
  { id: 'apex', label: 'Apex domains', tone: 'cyan' as const },
  { id: 'host', label: 'Hostnames', tone: 'green' as const },
  { id: 'wildcard', label: 'Wildcards', tone: 'yellow' as const },
];

export function CertSearchRadar({ data }: { data: CertSearchOutput }) {
  const apex = new Set(data.apexDomains);
  const blips: RadarBlip[] = data.domains.map((d) => ({
    id: d.name,
    label: d.name,
    group: d.wildcard ? 'wildcard' : apex.has(d.name) ? 'apex' : 'host',
    detail: `${d.certificates} certificate${d.certificates === 1 ? '' : 's'}, last seen ${d.lastSeen.slice(0, 10)}`,
    pivot: d.name.replace(/^\*\./, ''),
  }));
  // Apex domains first, so they survive the blip cap.
  blips.sort((a, b) => Number(b.group === 'apex') - Number(a.group === 'apex'));
  return (
    <DiscoveryRadar
      center={data.organisation}
      blips={blips}
      groups={GROUPS}
      exclude="cert-search"
    />
  );
}
