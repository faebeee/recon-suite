import { MAX_REVERSE_IP_DOMAINS } from '@recon/shared';

/** POST /v1/domains/list response (only the fields we use). */
export interface StDomainsListResponse {
  record_count?: number;
  records?: { hostname?: string; domain?: string }[];
  meta?: { total_pages?: number; page?: number; limit_reached?: boolean };
}

export interface ReverseIpPage {
  total: number;
  domains: string[];
  truncated: boolean;
}

/**
 * Maps the first result page. Live responses name the field `hostname`; the published
 * example uses `domain`, so both are accepted.
 */
export function mapDomainsList(body: StDomainsListResponse): ReverseIpPage {
  const names = new Set<string>();
  for (const r of body.records ?? []) {
    const name = (r.hostname ?? r.domain)?.trim().toLowerCase();
    if (name) names.add(name);
  }
  const domains = [...names].sort().slice(0, MAX_REVERSE_IP_DOMAINS);
  const total = Math.max(body.record_count ?? 0, names.size);
  return { total, domains, truncated: total > domains.length };
}
