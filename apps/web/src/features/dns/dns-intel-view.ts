import type { DnsOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

/** One ring per record type, one note per value (A/AAAA become IP notes). */
export function dnsIntelView(data: DnsOutput, target: string): Discovery {
  const sets = data.records.filter((r) => r.values.length > 0);
  return {
    center: target,
    groups: sets.map((r) => ({
      id: r.type,
      label: `${r.type} records`,
      tone: 'cyan',
    })),
    blips: sets.flatMap((r) =>
      r.values.map((v) => ({
        id: `${r.type}:${v}`,
        label: v,
        group: r.type,
        pivot: v,
      })),
    ),
  };
}
