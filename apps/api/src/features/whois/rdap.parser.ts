import type { WhoisEntity, WhoisOutput } from '@recon/shared';

/** Minimal shape of the RDAP fields we read (RFC 9083). */
export interface RdapObject {
  objectClassName?: string;
  handle?: string;
  ldhName?: string;
  unicodeName?: string;
  name?: string;
  status?: string[];
  events?: { eventAction: string; eventDate: string }[];
  nameservers?: { ldhName?: string }[];
  entities?: RdapEntity[];
  startAddress?: string;
  endAddress?: string;
  country?: string;
  type?: string;
  cidr0_cidrs?: { v4prefix?: string; v6prefix?: string; length: number }[];
}

interface RdapEntity {
  handle?: string;
  roles?: string[];
  vcardArray?: [string, [string, unknown, string, unknown][]];
  entities?: RdapEntity[];
}

function vcardName(entity: RdapEntity): string | undefined {
  const fn = entity.vcardArray?.[1]?.find(([key]) => key === 'fn');
  const value = fn?.[3];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function flattenEntities(entities: RdapEntity[] = []): WhoisEntity[] {
  return entities.flatMap((e) => [
    { roles: e.roles ?? [], name: vcardName(e), handle: e.handle },
    ...flattenEntities(e.entities),
  ]);
}

export function parseRdap(
  raw: RdapObject,
  kind: 'domain' | 'ip',
  queried: string,
  source: string,
): WhoisOutput {
  const entities = flattenEntities(raw.entities);
  const registrar = entities.find((e) => e.roles.includes('registrar'))?.name;

  return {
    kind,
    queried,
    handle: raw.handle,
    name: raw.unicodeName ?? raw.ldhName ?? raw.name,
    registrar,
    status: raw.status ?? [],
    events: (raw.events ?? []).map((e) => ({
      action: e.eventAction,
      date: e.eventDate,
    })),
    nameservers: (raw.nameservers ?? [])
      .map((ns) => ns.ldhName?.toLowerCase())
      .filter((n): n is string => !!n),
    entities,
    network:
      kind === 'ip'
        ? {
            startAddress: raw.startAddress,
            endAddress: raw.endAddress,
            cidr: raw.cidr0_cidrs?.map(
              (c) => `${c.v4prefix ?? c.v6prefix}/${c.length}`,
            ),
            country: raw.country,
            type: raw.type,
          }
        : undefined,
    source,
    raw,
  };
}

/** example.co.uk -> [example.co.uk, co.uk]; stops at two labels. */
export function domainCandidates(domain: string): string[] {
  const labels = domain.split('.');
  const out: string[] = [];
  for (let i = 0; labels.length - i >= 2; i++)
    out.push(labels.slice(i).join('.'));
  return out;
}
