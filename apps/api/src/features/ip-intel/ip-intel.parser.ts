import { isIPv4, isIPv6 } from 'node:net';
import type { IpAsn, IpNetwork, ProviderKind } from '@recon/shared';

/** Expands an IPv6 address to 8 groups of 4 hex digits (handles "::" and embedded IPv4). */
export function expandIpv6(ip: string): string {
  let addr = ip.toLowerCase().split('%')[0]!;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(addr)?.[1];
  if (v4) {
    const o = v4.split('.').map(Number);
    addr = addr.replace(
      v4,
      `${((o[0]! << 8) | o[1]!).toString(16)}:${((o[2]! << 8) | o[3]!).toString(16)}`,
    );
  }
  const [head = '', tail] = addr.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? h
      : [...h, ...Array<string>(8 - h.length - t.length).fill('0'), ...t];
  return groups.map((g) => g.padStart(4, '0')).join(':');
}

/** Normalised form for comparing addresses. */
export const canonicalIp = (ip: string) => (isIPv6(ip) ? expandIpv6(ip) : ip);

/** Query name for Team Cymru's IP-to-ASN DNS service. */
export function cymruOriginName(ip: string): string {
  if (isIPv4(ip))
    return `${ip.split('.').reverse().join('.')}.origin.asn.cymru.com`;
  const nibbles = expandIpv6(ip)
    .replace(/:/g, '')
    .split('')
    .reverse()
    .join('.');
  return `${nibbles}.origin6.asn.cymru.com`;
}

/** "13335 | 1.1.1.0/24 | AU | apnic | 2011-08-11" (several origins: first ASN wins). */
export function parseCymruOrigin(txt: string): IpAsn | undefined {
  const [asns, prefix, country, registry, allocated] = txt
    .split('|')
    .map((p) => p.trim());
  const number = Number(asns?.split(/\s+/)[0]);
  if (!Number.isInteger(number) || number <= 0) return undefined;
  return {
    number,
    prefix: prefix || undefined,
    country: country || undefined,
    registry: registry || undefined,
    allocated: allocated || undefined,
  };
}

/** "13335 | US | arin | 2010-07-14 | CLOUDFLARENET, US" -> "CLOUDFLARENET, US" */
export function parseCymruAsName(txt: string): string | undefined {
  return txt.split('|')[4]?.trim() || undefined;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, [string, unknown, string, unknown][]];
}
export interface RdapIpNetwork {
  handle?: string;
  name?: string;
  type?: string;
  country?: string;
  cidr0_cidrs?: { v4prefix?: string; v6prefix?: string; length?: number }[];
  startAddress?: string;
  endAddress?: string;
  entities?: RdapEntity[];
}

const vcardName = (e: RdapEntity) =>
  e.vcardArray?.[1]?.find((p) => p[0] === 'fn')?.[3] as string | undefined;

export function parseRdapNetwork(raw: RdapIpNetwork): IpNetwork {
  const cidr = (raw.cidr0_cidrs ?? [])
    .map((c) => {
      const prefix = c.v4prefix ?? c.v6prefix;
      return prefix && c.length !== undefined
        ? `${prefix}/${c.length}`
        : undefined;
    })
    .filter((c): c is string => !!c);
  if (!cidr.length && raw.startAddress && raw.endAddress) {
    cidr.push(`${raw.startAddress} - ${raw.endAddress}`);
  }
  const org =
    raw.entities?.find((e) => e.roles?.includes('registrant')) ??
    raw.entities?.find((e) => e.roles?.includes('administrative'));
  return {
    name: raw.name,
    handle: raw.handle,
    cidr,
    country: raw.country,
    type: raw.type,
    organisation: org ? vcardName(org) : undefined,
  };
}

/** Well-known ASNs of CDNs, clouds and large hosters. */
const PROVIDERS: Record<number, { name: string; kind: ProviderKind }> = {
  13335: { name: 'Cloudflare', kind: 'cdn' },
  209242: { name: 'Cloudflare', kind: 'cdn' },
  54113: { name: 'Fastly', kind: 'cdn' },
  20940: { name: 'Akamai', kind: 'cdn' },
  16625: { name: 'Akamai', kind: 'cdn' },
  12222: { name: 'Akamai', kind: 'cdn' },
  60068: { name: 'CDN77', kind: 'cdn' },
  19551: { name: 'Imperva', kind: 'cdn' },
  22822: { name: 'Edgio', kind: 'cdn' },
  200325: { name: 'Bunny CDN', kind: 'cdn' },
  16509: { name: 'Amazon Web Services', kind: 'cloud' },
  14618: { name: 'Amazon Web Services', kind: 'cloud' },
  15169: { name: 'Google', kind: 'cloud' },
  396982: { name: 'Google Cloud', kind: 'cloud' },
  8075: { name: 'Microsoft Azure', kind: 'cloud' },
  31898: { name: 'Oracle Cloud', kind: 'cloud' },
  36351: { name: 'IBM Cloud', kind: 'cloud' },
  45102: { name: 'Alibaba Cloud', kind: 'cloud' },
  14061: { name: 'DigitalOcean', kind: 'hosting' },
  24940: { name: 'Hetzner', kind: 'hosting' },
  213230: { name: 'Hetzner Cloud', kind: 'hosting' },
  16276: { name: 'OVHcloud', kind: 'hosting' },
  63949: { name: 'Akamai Connected Cloud (Linode)', kind: 'hosting' },
  20473: { name: 'Vultr', kind: 'hosting' },
  51167: { name: 'Contabo', kind: 'hosting' },
  12876: { name: 'Scaleway', kind: 'hosting' },
  8560: { name: 'IONOS', kind: 'hosting' },
  29802: { name: 'HIVELOCITY', kind: 'hosting' },
  36459: { name: 'GitHub', kind: 'hosting' },
  32934: { name: 'Meta', kind: 'cdn' },
};

export function providerForAsn(asn: number | undefined) {
  return asn === undefined ? undefined : PROVIDERS[asn];
}
