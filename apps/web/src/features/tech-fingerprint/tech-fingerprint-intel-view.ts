import { TECH_CATEGORIES, type TechFingerprintOutput } from '@recon/shared';
import type { Discovery } from '@/components/tool';

/** One ring per category, each technology as a software note with its version. */
export function techFingerprintIntelView(
  data: TechFingerprintOutput,
): Discovery {
  return {
    center: data.finalUrl,
    groups: TECH_CATEGORIES.map((c) => ({ id: c, label: c, tone: 'cyan' })),
    blips: data.technologies.map((t) => ({
      id: `${t.category}:${t.name}`,
      label: t.name,
      group: t.category,
      service: t.name,
      version: t.version,
      detail: [`Confidence: ${t.confidence}`, ...t.evidence].join('\n'),
    })),
  };
}
