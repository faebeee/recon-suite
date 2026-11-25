import type { JsEndpointsOutput } from '@recon/shared';
import {
  DiscoveryRadar,
  type Discovery,
  type RadarBlip,
} from '@/components/tool';

const GROUPS = [
  { id: 'secret', label: 'Possible secrets', tone: 'magenta' as const },
  { id: 'host', label: 'Hosts', tone: 'cyan' as const },
  { id: 'url', label: 'URLs', tone: 'green' as const },
  { id: 'path', label: 'API paths', tone: 'yellow' as const },
];

export function jsEndpointsDiscovery(
  data: Pick<JsEndpointsOutput, 'page' | 'secrets' | 'hosts' | 'endpoints'>,
): Discovery {
  const blips: RadarBlip[] = [
    // Secrets and hosts first: they matter most and must survive the blip cap.
    ...data.secrets.map((s, i) => ({
      id: `secret:${i}:${s.masked}`,
      label: `${s.type}: ${s.masked}`,
      group: 'secret',
      detail: `in ${s.source}`,
    })),
    ...data.hosts.map((h) => ({
      id: `host:${h}`,
      label: h,
      group: 'host',
      pivot: h,
    })),
    ...data.endpoints.map((e) => ({
      id: `${e.kind}:${e.value}`,
      label: e.value,
      group: e.kind,
      detail: `in ${e.sources.length} script${e.sources.length === 1 ? '' : 's'}`,
      ...(e.kind === 'url' && { pivot: e.value }),
    })),
  ];
  return { center: new URL(data.page).host, groups: GROUPS, blips };
}

export function JsEndpointsRadar({ data }: { data: JsEndpointsOutput }) {
  return (
    <DiscoveryRadar {...jsEndpointsDiscovery(data)} exclude="js-endpoints" />
  );
}
