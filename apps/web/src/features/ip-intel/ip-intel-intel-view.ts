import type { IpIntelOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

/** One IP note per address with ASN, network and provider in its title. */
export function ipIntelIntelView(data: IpIntelOutput): Discovery {
  return {
    center: data.query,
    groups: [{ id: 'address', label: 'Addresses', tone: 'cyan' }],
    blips: data.addresses.map((a) => ({
      id: a.ip,
      label: a.ip,
      group: 'address',
      pivot: a.ip,
      detail: [
        a.ptr.length > 0 && `PTR ${a.ptr.join(', ')}`,
        a.asn && `AS${a.asn.number}${a.asn.name ? ` ${a.asn.name}` : ''}`,
        a.network?.organisation ?? a.network?.name,
        a.provider && `${a.provider.name} (${a.provider.kind})`,
        (a.asn?.country ?? a.network?.country) || undefined,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  };
}
