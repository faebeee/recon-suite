import type { PortsOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

/** Open ports as service notes (`ssh`, `https`, ...); others are left out. */
export function portsIntelView(data: PortsOutput, target: string): Discovery {
  return {
    center: target,
    groups: [{ id: 'open', label: 'Open ports', tone: 'green' }],
    blips: data.results
      .filter((r) => r.state === 'open')
      .map((r) => ({
        id: `port:${r.port}`,
        label: `${r.port}/tcp`,
        group: 'open',
        service: r.service ?? 'tcp',
        detail: `${data.address}:${r.port}`,
      })),
  };
}
