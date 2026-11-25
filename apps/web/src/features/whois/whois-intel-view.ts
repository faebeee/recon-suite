import type { WhoisOutput } from '@recon/shared';
import type { Discovery, RadarBlip } from '@/components/tool';

export function whoisIntelView(data: WhoisOutput): Discovery {
  const net = data.network;
  const blips: RadarBlip[] = [
    {
      id: 'registration',
      label: data.name ?? data.handle ?? data.queried,
      group: 'registration',
      detail: [
        data.registrar && `Registrar: ${data.registrar}`,
        data.status.length > 0 && `Status: ${data.status.join(', ')}`,
        ...data.events.map((e) => `${e.action}: ${e.date.slice(0, 10)}`),
        net?.cidr?.length && `Network: ${net.cidr.join(', ')}`,
        net?.country && `Country: ${net.country}`,
        `Source: ${data.source}`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
    ...data.nameservers.map((ns) => ({
      id: `ns:${ns}`,
      label: ns,
      group: 'ns',
      pivot: ns,
    })),
    ...data.entities.map((e, i) => ({
      id: `entity:${i}`,
      label: e.name ?? e.handle ?? 'Unnamed',
      group: 'entity',
      detail: [e.roles.join(', '), e.handle].filter(Boolean).join(' · '),
    })),
  ];
  return {
    center: data.queried,
    groups: [
      { id: 'registration', label: 'Registration', tone: 'cyan' },
      { id: 'ns', label: 'Nameservers', tone: 'green' },
      { id: 'entity', label: 'Contacts', tone: 'muted' },
    ],
    blips,
  };
}
