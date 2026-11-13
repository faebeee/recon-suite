import { isIP } from 'node:net';
import type { OrgDomain } from '@recon/shared';

export const MAX_ORG_DOMAINS = 2000;

/** Fields of a crt.sh JSON row for an organisation (`?O=`) search. */
export interface CrtShOrgEntry {
  id?: number;
  serial_number?: string;
  issuer_ca_id?: number;
  /** The certificate's subject CN: a hostname for TLS certificates. */
  common_name?: string;
  /** For `?O=` searches crt.sh puts the matched organisation here, not the SANs. */
  name_value?: string;
  not_before: string;
  not_after: string;
}

export interface OrgCertSummary {
  certificates: number;
  domains: OrgDomain[];
  apexDomains: string[];
}

const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/;

/** Lowercased hostname (wildcard prefix removed) or undefined for emails, IPs, person names. */
export function toHostname(
  raw: string,
): { name: string; wildcard: boolean } | undefined {
  let name = raw.trim().toLowerCase().replace(/\.$/, '');
  const wildcard = name.startsWith('*.');
  if (wildcard) name = name.slice(2);
  if (!name || isIP(name) || !HOSTNAME.test(name)) return undefined;
  return { name, wildcard };
}

/**
 * Aggregates crt.sh rows of an organisation search into distinct names.
 * crt.sh returns the precertificate and the final certificate as two rows with the same
 * issuer and serial; they are counted once. Expired certificates are filtered here because
 * crt.sh answers 404 to `exclude=expired` on `?O=` searches (checked live).
 */
export function aggregateOrgCerts(
  entries: CrtShOrgEntry[],
  opts: { includeExpired: boolean; now?: Date },
): OrgCertSummary {
  const now = (opts.now ?? new Date()).toISOString().slice(0, 19);
  const seen = new Set<string>();
  const map = new Map<string, OrgDomain>();
  let certificates = 0;

  for (const entry of entries) {
    if (!opts.includeExpired && entry.not_after < now) continue;
    const key =
      entry.serial_number !== undefined
        ? `${entry.issuer_ca_id ?? ''}/${entry.serial_number}`
        : `id/${entry.id ?? certificates}`;
    if (seen.has(key)) continue;
    seen.add(key);
    certificates++;

    const host = entry.common_name ? toHostname(entry.common_name) : undefined;
    if (!host) continue;
    const existing = map.get(host.name);
    if (!existing) {
      map.set(host.name, {
        name: host.name,
        wildcard: host.wildcard,
        certificates: 1,
        firstSeen: entry.not_before,
        lastSeen: entry.not_after,
      });
      continue;
    }
    existing.wildcard ||= host.wildcard;
    existing.certificates++;
    if (entry.not_before < existing.firstSeen)
      existing.firstSeen = entry.not_before;
    if (entry.not_after > existing.lastSeen)
      existing.lastSeen = entry.not_after;
  }

  const domains = [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return {
    certificates,
    domains: domains.slice(0, MAX_ORG_DOMAINS),
    apexDomains: apexDomains(domains),
  };
}

/** Second-level labels that commonly form a public suffix under a ccTLD (co.uk, com.au). */
const CC_SECOND_LEVEL = new Set([
  'co',
  'com',
  'net',
  'org',
  'gov',
  'ac',
  'edu',
]);

/**
 * Approximates the registrable domain without a Public Suffix List: the last two labels,
 * or three when the name ends in a common ccTLD second level such as co.uk or com.au.
 * Other multi-part suffixes (e.g. city.kawasaki.jp, *.blogspot.com) are not recognised.
 */
export function apexOf(name: string): string {
  const labels = name.split('.');
  const take =
    labels.length > 2 &&
    labels.at(-1)!.length === 2 &&
    CC_SECOND_LEVEL.has(labels.at(-2)!)
      ? 3
      : 2;
  return labels.slice(-take).join('.');
}

/** Distinct apex domains (see apexOf), most certificates first. */
export function apexDomains(domains: OrgDomain[]): string[] {
  const counts = new Map<string, number>();
  for (const d of domains) {
    const apex = apexOf(d.name);
    counts.set(apex, (counts.get(apex) ?? 0) + d.certificates);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([apex]) => apex);
}
