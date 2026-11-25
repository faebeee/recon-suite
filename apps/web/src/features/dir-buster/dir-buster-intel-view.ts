import type { DirBusterOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

export function dirBusterIntelView(data: DirBusterOutput): Discovery {
  return {
    center: data.base,
    groups: [
      { id: 'directory', label: 'Directories', tone: 'cyan' },
      { id: 'file', label: 'Files', tone: 'green' },
    ],
    blips: data.hits.map((h) => ({
      id: h.url,
      label: h.path,
      group: h.kind,
      pivot: h.url,
      detail: [
        String(h.status),
        h.length !== undefined && `${h.length} B`,
        h.title,
        h.listing && 'directory listing',
        h.redirect && `→ ${h.redirect}`,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  };
}
