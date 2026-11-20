import type { SubdomainsOutput } from '@recon/shared';
import { DiscoveryRadar, type RadarBlip } from '@/components/tool';

const GROUPS = [
  { id: 'direct', label: 'One level', tone: 'cyan' as const },
  { id: 'deep', label: 'Deeper', tone: 'green' as const },
  { id: 'wildcard', label: 'Wildcard', tone: 'yellow' as const },
];

export function SubdomainsRadar({
  data,
  target,
}: {
  data: SubdomainsOutput;
  target: string;
}) {
  const depth = target.split('.').length;
  const blips: RadarBlip[] = data.subdomains
    .filter((s) => s.name !== target)
    .map((s) => {
      const host = s.name.replace(/^\*\./, '');
      return {
        id: s.name,
        label: s.name,
        group: s.wildcard
          ? 'wildcard'
          : s.name.split('.').length - depth > 1
            ? 'deep'
            : 'direct',
        detail: `${s.certificates} certificate${s.certificates === 1 ? '' : 's'}, last seen ${s.lastSeen.slice(0, 10)}`,
        pivot: host,
      };
    });
  return (
    <DiscoveryRadar
      center={target}
      blips={blips}
      groups={GROUPS}
      exclude="subdomains"
    />
  );
}
