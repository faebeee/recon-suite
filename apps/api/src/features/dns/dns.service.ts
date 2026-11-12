import { Injectable, NotFoundException } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import {
  DNS_RESOLVERS,
  type DnsOutput,
  type DnsParams,
  type DnsRecordSet,
  type DnsRecordType,
} from '@recon/shared';
import {
  EMPTY_CODES,
  formatCaa,
  formatMx,
  formatSoa,
  formatTxt,
} from './dns.formatters.js';

type Query = (r: Resolver, name: string) => Promise<string[]>;

const QUERIES: Record<DnsRecordType, Query> = {
  A: (r, n) => r.resolve4(n),
  AAAA: (r, n) => r.resolve6(n),
  CNAME: (r, n) => r.resolveCname(n),
  MX: async (r, n) => formatMx(await r.resolveMx(n)),
  NS: (r, n) => r.resolveNs(n),
  TXT: async (r, n) => formatTxt(await r.resolveTxt(n)),
  SOA: async (r, n) => formatSoa(await r.resolveSoa(n)),
  CAA: async (r, n) => formatCaa(await r.resolveCaa(n)),
};

@Injectable()
export class DnsService {
  async lookup({ target, types, resolver }: DnsParams): Promise<DnsOutput> {
    const r = new Resolver({ timeout: 3000, tries: 2 });
    const servers: string[] = [...DNS_RESOLVERS[resolver]];
    if (servers.length) r.setServers(servers);

    let notFound = 0;
    const records = await Promise.all(
      types.map(async (type): Promise<DnsRecordSet> => {
        try {
          return { type, values: await QUERIES[type](r, target) };
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code ?? '';
          if (code === 'ENOTFOUND') notFound++;
          if (EMPTY_CODES.has(code)) return { type, values: [] };
          return { type, values: [], error: code || (err as Error).message };
        }
      }),
    );

    if (notFound === types.length) {
      throw new NotFoundException(`NXDOMAIN: ${target} does not exist`);
    }
    return {
      resolver,
      servers: servers.length ? servers : r.getServers(),
      records,
    };
  }
}
