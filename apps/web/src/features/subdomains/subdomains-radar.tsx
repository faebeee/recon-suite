import type { SubdomainsOutput } from '@recon/shared';
import { DiscoveryRadar, type Discovery } from '@/components/tool';

const GROUPS = [
  { id: 'direct', label: 'One level', tone: 'cyan' as const },
  { id: 'deep', label: 'Deeper', tone: 'green' as const },
  { id: 'wildcard', label: 'Wildcard', tone: 'yellow' as const },
];

export function subdomainsDiscovery(
  subdomains: SubdomainsOutput['subdomains'],
  target: string,
): Discovery {
  const depth = target.split('.').length;
  return {
    center: target,
    groups: GROUPS,
    blips: subdomains
      .filter((s) => s.name !== target)
      .map((s) => ({
        id: s.name,
        label: s.name,
        group: s.wildcard
          ? 'wildcard'
          : s.name.split('.').length - depth > 1
            ? 'deep'
            : 'direct',
        detail: `${s.certificates} certificate${s.certificates === 1 ? '' : 's'}, last seen ${s.lastSeen.slice(0, 10)}`,
        pivot: s.name.replace(/^\*\./, ''),
      })),
  };
}

export function SubdomainsRadar({
  data,
  target,
}: {
  data: SubdomainsOutput;
  target: string;
}) {
  return (
    <DiscoveryRadar
      {...subdomainsDiscovery(data.subdomains, target)}
      exclude="subdomains"
    />
  );
}
