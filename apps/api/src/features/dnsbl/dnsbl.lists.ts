import type { DnsblCheck, Finding } from '@recon/shared';

export interface Blocklist {
  name: string;
  zone: string;
  target: 'ip' | 'domain';
  /** Meaning of a return code; undefined = generic listing. */
  decode?: (code: string) => { reason: string; policy?: boolean } | undefined;
}

/** Spamhaus answers 127.255.255.x for refused queries (public resolver, typo, rate limit). */
const SPAMHAUS_REFUSED = /^127\.255\.255\.\d+$/;

const ZEN: Record<string, { reason: string; policy?: boolean }> = {
  '127.0.0.2': { reason: 'Spamhaus Block List (SBL)' },
  '127.0.0.3': { reason: 'Spamhaus CSS (snowshoe spam)' },
  '127.0.0.4': { reason: 'Exploits Block List (XBL)' },
  '127.0.0.5': { reason: 'Exploits Block List (XBL)' },
  '127.0.0.6': { reason: 'Exploits Block List (XBL)' },
  '127.0.0.7': { reason: 'Exploits Block List (XBL)' },
  '127.0.0.9': { reason: 'Spamhaus DROP (hijacked range)' },
  '127.0.0.10': {
    reason: 'Policy Block List (PBL, ISP-maintained)',
    policy: true,
  },
  '127.0.0.11': {
    reason: 'Policy Block List (PBL, dynamic or end-user range)',
    policy: true,
  },
};

const DBL: Record<string, string> = {
  '127.0.1.2': 'Spam domain',
  '127.0.1.4': 'Phishing domain',
  '127.0.1.5': 'Malware domain',
  '127.0.1.6': 'Botnet C&C domain',
  '127.0.1.102': 'Abused legit domain (spam)',
  '127.0.1.103': 'Abused legit domain (spammed redirector)',
  '127.0.1.104': 'Abused legit domain (phishing)',
  '127.0.1.105': 'Abused legit domain (malware)',
  '127.0.1.106': 'Abused legit domain (botnet C&C)',
};

const SURBL_BITS: [number, string][] = [
  [8, 'Phishing (PH)'],
  [16, 'Malware (MW)'],
  [64, 'Abuse / spam (ABUSE)'],
  [128, 'Cracked site (CR)'],
];

export const BLOCKLISTS: Blocklist[] = [
  {
    name: 'Spamhaus ZEN',
    zone: 'zen.spamhaus.org',
    target: 'ip',
    decode: (c) => ZEN[c],
  },
  { name: 'SpamCop', zone: 'bl.spamcop.net', target: 'ip' },
  { name: 'Barracuda', zone: 'b.barracudacentral.org', target: 'ip' },
  { name: 'PSBL', zone: 'psbl.surriel.com', target: 'ip' },
  { name: 'UCEPROTECT L1', zone: 'dnsbl-1.uceprotect.net', target: 'ip' },
  {
    name: 'Spamhaus DBL',
    zone: 'dbl.spamhaus.org',
    target: 'domain',
    decode: (c) => (DBL[c] ? { reason: DBL[c] } : undefined),
  },
  {
    name: 'SURBL',
    zone: 'multi.surbl.org',
    target: 'domain',
    decode: (c) => {
      const last = Number(c.split('.')[3]);
      const reasons = SURBL_BITS.filter(([bit]) => last & bit).map(
        ([, r]) => r,
      );
      return reasons.length ? { reason: reasons.join(', ') } : undefined;
    },
  },
];

/** 192.0.2.1 -> 1.2.0.192 */
export function reverseIpv4(ip: string): string {
  return ip.split('.').reverse().join('.');
}

export function queryName(list: Blocklist, subject: string): string {
  return `${list.target === 'ip' ? reverseIpv4(subject) : subject}.${list.zone}`;
}

/** Resolves A records; `[]` means NXDOMAIN/NODATA (not listed). Other errors throw. */
export type Lookup = (name: string) => Promise<string[]>;

const NOT_LISTED = new Set(['ENOTFOUND', 'ENODATA']);

export async function checkList(
  list: Blocklist,
  subject: string,
  lookup: Lookup,
): Promise<DnsblCheck> {
  const base = { list: list.name, zone: list.zone, subject };
  let codes: string[];
  try {
    codes = await lookup(queryName(list, subject));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? '';
    if (NOT_LISTED.has(code)) {
      return { ...base, status: 'clean', codes: [], reasons: [] };
    }
    return {
      ...base,
      status: 'error',
      codes: [],
      reasons: [],
      error: code || (err instanceof Error ? err.message : String(err)),
    };
  }
  if (!codes.length)
    return { ...base, status: 'clean', codes: [], reasons: [] };
  // Answers outside 127.0.0.0/8 are not list data (e.g. a wildcarding resolver).
  if (!codes.every((c) => c.startsWith('127.'))) {
    return {
      ...base,
      status: 'error',
      codes,
      reasons: [],
      error: 'Unexpected answer (the resolver may rewrite NXDOMAIN)',
    };
  }
  const refused =
    codes.some((c) => SPAMHAUS_REFUSED.test(c)) ||
    codes.includes('127.0.1.255');
  if (refused) {
    return {
      ...base,
      status: 'refused',
      codes,
      reasons: [],
      error:
        'The list refused the query (public or unregistered resolver, or rate limit). Run the API with its own resolver.',
    };
  }
  const decoded = codes.map((c) => list.decode?.(c));
  const reasons = [
    ...new Set(decoded.map((d, i) => d?.reason ?? `Listed (${codes[i]})`)),
  ];
  const policyOnly = decoded.every((d) => d?.policy);
  return {
    ...base,
    status: 'listed',
    codes,
    reasons,
    ...(policyOnly && { policyOnly: true }),
  };
}

export function dnsblFindings(checks: DnsblCheck[]): Finding[] {
  return checks.map((c) => {
    const id = `dnsbl.${c.zone}.${c.subject}`;
    const title = `${c.list}: ${c.subject}`;
    switch (c.status) {
      case 'listed':
        return c.policyOnly
          ? {
              id,
              status: 'info',
              title,
              message: `${c.reasons.join(', ')}: this range should not send mail directly. Not an abuse listing.`,
              value: c.codes.join(', '),
            }
          : {
              id,
              status: 'fail',
              title,
              message: `Listed: ${c.reasons.join(', ')}. Mail from it is likely rejected; find the cause and request delisting.`,
              value: c.codes.join(', '),
            };
      case 'clean':
        return { id, status: 'pass', title, message: 'Not listed.' };
      default:
        return {
          id,
          status: 'info',
          title,
          message: c.error ?? 'Lookup failed.',
        };
    }
  });
}
