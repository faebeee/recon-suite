import type { BannerGrabOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

/** Ports that answered, as service notes with the banner as body. */
export function bannerGrabIntelView(
  data: BannerGrabOutput,
  target: string,
): Discovery {
  return {
    center: target,
    groups: [
      { id: 'banner', label: 'Banners', tone: 'green' },
      { id: 'silent', label: 'Open, no banner', tone: 'muted' },
    ],
    blips: data.results
      .filter((r) => r.state === 'banner' || r.state === 'silent')
      .map((r) => ({
        id: `port:${r.port}`,
        label: `${r.port}/tcp${r.tls ? ' (TLS)' : ''}`,
        group: r.state,
        service: r.service ?? r.product ?? 'tcp',
        version: [r.product, r.version].filter(Boolean).join(' ') || undefined,
        detail: r.banner && `\`\`\`\n${r.banner}\n\`\`\``,
      })),
  };
}
