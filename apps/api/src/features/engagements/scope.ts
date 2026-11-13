import { BlockList, isIP, isIPv4 } from 'node:net';
import { normalizeHost } from '@recon/shared';

export type ScopeKind = 'domain' | 'wildcard' | 'ip' | 'cidr';

export interface ScopeRule {
  kind: ScopeKind;
  /** Normalised value: example.com, *.example.com, 192.0.2.1, 192.0.2.0/24 */
  value: string;
  /** Exclusions win over inclusions. */
  excluded: boolean;
}

export interface ScopeDecision {
  inScope: boolean;
  /** The rule that decided, if any. */
  rule?: ScopeRule;
  reason: string;
}

const DOMAIN_RE =
  /^(?=.{1,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;

/**
 * Parses what a user types into the scope list: a domain, "*.domain", an IP, a CIDR or a
 * URL (its hostname is used). Throws a human-readable Error for anything else.
 */
export function parseScopeValue(raw: string): {
  kind: ScopeKind;
  value: string;
} {
  const input = raw.trim().toLowerCase();
  const cidr = /^([0-9a-f:.]+)\/(\d{1,3})$/.exec(input);
  if (cidr) {
    const family = isIP(cidr[1]!);
    const bits = Number(cidr[2]);
    if (!family || bits > (family === 4 ? 32 : 128)) {
      throw new Error(`"${raw}" is not a valid CIDR range`);
    }
    return { kind: 'cidr', value: `${cidr[1]}/${bits}` };
  }
  if (input.startsWith('*.')) {
    const base = normalizeHost(input.slice(2));
    if (!DOMAIN_RE.test(base))
      throw new Error(`"${raw}" is not a valid wildcard domain`);
    return { kind: 'wildcard', value: `*.${base}` };
  }
  const host = normalizeHost(input);
  if (isIP(host)) return { kind: 'ip', value: host };
  if (DOMAIN_RE.test(host)) return { kind: 'domain', value: host };
  throw new Error(
    `"${raw}" is not a domain, *.domain, IP address, CIDR range or URL`,
  );
}

function matches(rule: ScopeRule, host: string): boolean {
  switch (rule.kind) {
    case 'domain':
      return host === rule.value;
    case 'wildcard':
      return host.endsWith(rule.value.slice(1)); // ".example.com"
    case 'ip':
      return isIP(host) > 0 && canonical(host) === canonical(rule.value);
    case 'cidr': {
      const family = isIP(host);
      if (!family) return false;
      const [net, bits] = rule.value.split('/');
      const type = isIPv4(net!) ? 'ipv4' : 'ipv6';
      if ((family === 4) !== (type === 'ipv4')) return false;
      const list = new BlockList();
      list.addSubnet(net!, Number(bits), type);
      return list.check(host, type);
    }
  }
}

/** Canonical IP text for comparison (expands IPv6 via URL parsing). */
function canonical(ip: string): string {
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
}

/**
 * Decides whether a tool target (domain, IP or URL) is in scope. Exclusions are checked
 * first. Domains are only matched by domain/wildcard rules and IPs only by ip/cidr rules:
 * a domain is not in scope just because it resolves into an in-scope range.
 */
export function checkScope(rules: ScopeRule[], target: string): ScopeDecision {
  const host = normalizeHost(target);
  const exclusion = rules.find((r) => r.excluded && matches(r, host));
  if (exclusion) {
    return {
      inScope: false,
      rule: exclusion,
      reason: `${host} is excluded by ${exclusion.value}`,
    };
  }
  const inclusion = rules.find((r) => !r.excluded && matches(r, host));
  if (inclusion) {
    return {
      inScope: true,
      rule: inclusion,
      reason: `${host} matches ${inclusion.value}`,
    };
  }
  if (!rules.some((r) => !r.excluded)) {
    return {
      inScope: false,
      reason: 'The engagement has no scope entries yet',
    };
  }
  return { inScope: false, reason: `${host} is not in the engagement scope` };
}
