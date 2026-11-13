import type { Finding, TakeoverCandidate, TakeoverStatus } from '@recon/shared';
import { matchFingerprint, type TakeoverProvider } from './providers.js';

export const MAX_CNAME_HOPS = 5;

/** DNS lookups used by the takeover check (errors carry node:dns codes). */
export interface TakeoverDns {
  /** CNAME targets of `name` (empty or ENODATA when there is none). */
  cname(name: string): Promise<string[]>;
  /** A + AAAA addresses of `name`. */
  addresses(name: string): Promise<string[]>;
}

export interface ChainResult {
  /** CNAME chain, first hop first. */
  chain: string[];
  /** The last name in the chain (or the host itself) is NXDOMAIN. */
  dangling: boolean;
  /** The host itself does not exist. */
  hostMissing: boolean;
  /** A lookup failed for another reason (timeout, SERVFAIL). */
  error?: string;
}

const code = (err: unknown) => (err as NodeJS.ErrnoException).code;
const strip = (n: string) => n.toLowerCase().replace(/\.$/, '');

/** Follows the CNAME chain (max MAX_CNAME_HOPS) and checks whether its end resolves. */
export async function resolveChain(
  host: string,
  dns: TakeoverDns,
): Promise<ChainResult> {
  const chain: string[] = [];
  let current = host;
  for (let hop = 0; hop < MAX_CNAME_HOPS; hop++) {
    let targets: string[];
    try {
      targets = await dns.cname(current);
    } catch (err) {
      if (code(err) === 'ENODATA') break;
      if (code(err) === 'ENOTFOUND') {
        return { chain, dangling: hop > 0, hostMissing: hop === 0 };
      }
      return {
        chain,
        dangling: false,
        hostMissing: false,
        error: `CNAME lookup for ${current} failed (${code(err) ?? 'error'})`,
      };
    }
    const next = targets[0] ? strip(targets[0]) : undefined;
    if (!next || chain.includes(next) || next === host) break;
    chain.push(next);
    current = next;
  }
  if (chain.length === 0) {
    return { chain, dangling: false, hostMissing: false };
  }
  try {
    await dns.addresses(current);
    return { chain, dangling: false, hostMissing: false };
  } catch (err) {
    if (code(err) === 'ENOTFOUND') {
      return { chain, dangling: true, hostMissing: false };
    }
    if (code(err) === 'ENODATA') {
      return { chain, dangling: false, hostMissing: false };
    }
    return {
      chain,
      dangling: false,
      hostMissing: false,
      error: `Address lookup for ${current} failed (${code(err) ?? 'error'})`,
    };
  }
}

/** Whether the HTTP body has to be fetched to decide. */
export function needsBody(
  provider: TakeoverProvider | undefined,
  dangling: boolean,
): boolean {
  return !!provider?.fingerprints?.length && !dangling;
}

export type BodyResult = { text: string } | { error: string };

/** Turns DNS (and optionally HTTP) evidence into a verdict. Pure. */
export function classify(
  host: string,
  resolved: ChainResult,
  provider: TakeoverProvider | undefined,
  body?: BodyResult,
): TakeoverCandidate {
  const { chain, dangling } = resolved;
  const base = { host, cname: chain, dangling };
  const target = chain.at(-1) ?? host;
  const out = (status: TakeoverStatus, reason: string): TakeoverCandidate => ({
    ...base,
    ...(provider ? { provider: provider.name } : {}),
    status,
    reason,
  });

  if (resolved.error) return out('unknown', resolved.error);

  if (provider) {
    if (dangling) {
      if (provider.nxdomain && !provider.edgeCase) {
        return out(
          'vulnerable',
          `CNAME target ${target} does not exist; ${provider.name} lets anyone register that name`,
        );
      }
      return out(
        'likely',
        `CNAME to ${provider.name} (${target}) does not resolve; the resource was probably deleted`,
      );
    }
    if (body) {
      if ('error' in body) {
        return out('unknown', `Could not fetch http://${host}/: ${body.error}`);
      }
      const fp = matchFingerprint(provider, body.text);
      if (fp) {
        return provider.edgeCase
          ? out(
              'likely',
              `${provider.name} reports an unclaimed resource ("${fp}"); claiming it depends on the provider's verification (edge case)`,
            )
          : out(
              'vulnerable',
              `${provider.name} reports an unclaimed resource ("${fp}")`,
            );
      }
      return out('safe', `${provider.name} serves the resource normally`);
    }
    return out('safe', `CNAME to ${provider.name} resolves`);
  }

  if (dangling) {
    return out(
      'likely',
      `Dangling CNAME to unknown provider: ${target} does not exist`,
    );
  }
  return out('safe', `CNAME resolves (${target}); no takeover-prone provider`);
}

const ORDER: Record<TakeoverStatus, number> = {
  vulnerable: 0,
  likely: 1,
  unknown: 2,
  safe: 3,
};

export function sortCandidates(c: TakeoverCandidate[]): TakeoverCandidate[] {
  return [...c].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.host.localeCompare(b.host),
  );
}

export function buildTakeoverFindings(
  candidates: TakeoverCandidate[],
  checked: number,
): Finding[] {
  const f: Finding[] = [];
  for (const c of candidates) {
    if (c.status === 'vulnerable') {
      f.push({
        id: `takeover.${c.host}`,
        status: 'fail',
        title: `Subdomain takeover: ${c.host}`,
        message: `${c.reason}. Remove the DNS record or re-create the resource.`,
        value: c.cname.join(' -> ') || undefined,
      });
    } else if (c.status === 'likely') {
      f.push({
        id: `takeover.${c.host}`,
        status: 'warn',
        title: `Possible takeover: ${c.host}`,
        message: `${c.reason}. Verify and remove the stale DNS record.`,
        value: c.cname.join(' -> ') || undefined,
      });
    }
  }
  if (!f.length) {
    f.push({
      id: 'takeover.none',
      status: 'pass',
      title: 'No takeover candidates',
      message: `None of the ${checked} checked hosts points to a dangling or unclaimed resource.`,
    });
  }
  return f;
}

/** Unique subdomains of `domain` from crt.sh entries ("*." prefixes removed). */
export function parseCtNames(
  entries: { name_value?: string }[],
  domain: string,
): string[] {
  const names = new Set<string>();
  const suffix = `.${domain}`;
  for (const e of entries) {
    for (const raw of (e.name_value ?? '').split('\n')) {
      let name = raw.trim().toLowerCase().replace(/\.$/, '');
      if (name.startsWith('*.')) name = name.slice(2);
      if (name.includes('*') || name.includes(' ')) continue;
      if (name === domain || name.endsWith(suffix)) names.add(name);
    }
  }
  return [...names].sort();
}
