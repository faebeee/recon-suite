import type { WaybackOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

/** Interesting archived URLs first, then the rest (Intel View's note cap cuts the tail). */
export function waybackIntelView(data: WaybackOutput): Discovery {
  const interesting = new Set(data.interesting.map((i) => i.url));
  return {
    center: data.domain,
    groups: [
      { id: 'interesting', label: 'Interesting URLs', tone: 'yellow' },
      { id: 'url', label: 'Archived URLs', tone: 'cyan' },
    ],
    blips: [
      ...data.interesting.map((i) => ({
        id: `i:${i.url}`,
        label: i.url,
        group: 'interesting',
        detail: i.reason,
        pivot: i.url,
      })),
      ...data.urls
        .filter((u) => !interesting.has(u.url))
        .map((u) => ({
          id: `u:${u.url}`,
          label: u.url,
          group: 'url',
          detail: [u.status, u.mimeType, `last seen ${u.lastSeen.slice(0, 10)}`]
            .filter(Boolean)
            .join(' · '),
          pivot: u.url,
        })),
    ],
  };
}
