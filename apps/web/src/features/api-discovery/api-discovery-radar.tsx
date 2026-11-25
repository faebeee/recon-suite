import type { ApiDiscoveryOutput } from '@recon/shared';
import {
  DiscoveryRadar,
  type Discovery,
  type RadarBlip,
} from '@/components/tool';

const GROUPS = [
  { id: 'spec', label: 'Specs', tone: 'yellow' as const },
  { id: 'graphql', label: 'GraphQL', tone: 'magenta' as const },
  { id: 'docs', label: 'Doc pages', tone: 'cyan' as const },
  { id: 'endpoint', label: 'Endpoints', tone: 'green' as const },
];

export function apiDiscoveryDiscovery(
  data: Pick<ApiDiscoveryOutput, 'origin' | 'specs' | 'graphql' | 'docPages'>,
): Discovery {
  const blips: RadarBlip[] = [
    ...data.specs.map((s) => ({
      id: `spec:${s.url}`,
      label: new URL(s.url).pathname,
      group: 'spec',
      detail: `${s.version}${s.title ? `: ${s.title}` : ''}, ${s.operations} operations`,
      pivot: s.url,
    })),
    ...data.graphql.map((g) => ({
      id: `gql:${g.url}`,
      label: new URL(g.url).pathname,
      group: 'graphql',
      tone: g.introspection ? undefined : ('green' as const),
      detail: g.introspection
        ? `Introspection on: ${g.queries.length} queries, ${g.mutations.length} mutations`
        : 'Introspection disabled',
      pivot: g.url,
    })),
    ...data.docPages.map((p) => ({
      id: `docs:${p}`,
      label: new URL(p).pathname,
      group: 'docs',
      pivot: p,
    })),
    ...data.specs.flatMap((s) =>
      s.endpoints.map((e) => ({
        id: `ep:${s.url}:${e.method} ${e.path}`,
        label: `${e.method} ${e.path}`,
        group: 'endpoint',
        detail: e.summary,
      })),
    ),
  ];
  return { center: data.origin, groups: GROUPS, blips };
}

export function ApiDiscoveryRadar({ data }: { data: ApiDiscoveryOutput }) {
  return (
    <DiscoveryRadar {...apiDiscoveryDiscovery(data)} exclude="api-discovery" />
  );
}
