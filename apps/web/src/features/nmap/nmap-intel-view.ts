import type { NmapOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

/** Every reported port as a service note with product and version. */
export function nmapIntelView(data: NmapOutput, target: string): Discovery {
  return {
    center: target,
    groups: [{ id: 'port', label: 'Ports', tone: 'green' }],
    blips: data.ports.map((p) => ({
      id: `${p.protocol}:${p.port}`,
      label: `${p.port}/${p.protocol}`,
      group: 'port',
      service: p.service ?? p.protocol,
      version: [p.product, p.version].filter(Boolean).join(' ') || undefined,
      detail: [
        `State: ${p.state}${p.reason ? ` (${p.reason})` : ''}`,
        p.extraInfo,
        p.cpe.length > 0 && `CPE: ${p.cpe.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n'),
    })),
  };
}
