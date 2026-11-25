import type { FaviconHashOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

/** Each icon with its hashes and the search queries that find other hosts using it. */
export function faviconHashIntelView(data: FaviconHashOutput): Discovery {
  return {
    center: data.page,
    groups: [{ id: 'icon', label: 'Favicons', tone: 'cyan' }],
    blips: data.icons
      .filter((i) => i.mmh3 !== undefined || i.md5)
      .map((i) => ({
        id: i.url,
        label: i.url,
        group: 'icon',
        detail: [
          i.mmh3 !== undefined && `mmh3: \`${i.mmh3}\``,
          i.md5 && `md5: \`${i.md5}\``,
          i.sha256 && `sha256: \`${i.sha256}\``,
          ...(i.queries ?? []).map((q) => `${q.engine}: \`${q.query}\``),
        ]
          .filter(Boolean)
          .join('\n'),
      })),
  };
}
