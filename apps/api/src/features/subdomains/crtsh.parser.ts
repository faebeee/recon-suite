import type { Subdomain } from '@recon/shared';

export interface CrtShEntry {
  name_value: string;
  not_before: string;
  not_after: string;
}

/** Aggregates crt.sh certificate entries into unique subdomains of `domain`. */
export function parseCrtSh(entries: CrtShEntry[], domain: string): Subdomain[] {
  const map = new Map<string, Subdomain>();
  const suffix = `.${domain}`;

  for (const entry of entries) {
    for (const rawName of entry.name_value.split('\n')) {
      let name = rawName.trim().toLowerCase();
      const wildcard = name.startsWith('*.');
      if (wildcard) name = name.slice(2);
      if (name !== domain && !name.endsWith(suffix)) continue;

      const existing = map.get(name);
      if (!existing) {
        map.set(name, {
          name,
          wildcard,
          firstSeen: entry.not_before,
          lastSeen: entry.not_after,
          certificates: 1,
        });
        continue;
      }
      existing.wildcard ||= wildcard;
      existing.certificates++;
      if (entry.not_before < existing.firstSeen)
        existing.firstSeen = entry.not_before;
      if (entry.not_after > existing.lastSeen)
        existing.lastSeen = entry.not_after;
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
