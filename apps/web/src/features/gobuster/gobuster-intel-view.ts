import type { GobusterOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

/** Found paths, one ring per status class. */
export function gobusterIntelView(data: GobusterOutput): Discovery {
  const cls = (s: number) => `${Math.floor(s / 100)}xx`;
  return {
    center: data.base,
    groups: ['2xx', '3xx', '4xx', '5xx'].map((id) => ({
      id,
      label: `${id} responses`,
      tone: 'cyan',
    })),
    blips: data.hits.map((h) => ({
      id: h.url,
      label: h.path,
      group: cls(h.status),
      pivot: h.url,
      detail: [
        String(h.status),
        h.length !== undefined && `${h.length} B`,
        h.redirect && `→ ${h.redirect}`,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  };
}
