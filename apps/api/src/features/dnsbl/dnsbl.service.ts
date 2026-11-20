import { Injectable, NotFoundException } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';
import {
  MAX_DNSBL_ADDRESSES,
  type DnsblOutput,
  type DnsblParams,
} from '@recon/shared';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import {
  BLOCKLISTS,
  checkList,
  dnsblFindings,
  type Lookup,
} from './dnsbl.lists.js';

/**
 * Passive: only DNS queries to the resolver and the list operators. Uses the host's resolver,
 * because Spamhaus refuses queries that arrive through big public resolvers.
 */
@Injectable()
export class DnsblService {
  /** Overridable in tests. */
  protected createResolver(): {
    lookup: Lookup;
    servers: string[];
    resolve6: Lookup;
  } {
    const r = new Resolver({ timeout: 3000, tries: 2 });
    return {
      lookup: (name) => r.resolve4(name),
      resolve6: (name) => r.resolve6(name),
      servers: r.getServers(),
    };
  }

  async check({ target }: DnsblParams): Promise<DnsblOutput> {
    const { lookup, resolve6, servers } = this.createResolver();
    const kind = isIPv4(target) || isIPv6(target) ? 'ip' : 'domain';

    let addresses: string[] = [];
    let skippedIpv6: string[] = [];
    if (kind === 'ip') {
      if (isIPv4(target)) addresses = [target];
      else skippedIpv6 = [target];
    } else {
      const [v4, v6] = await Promise.all([
        lookup(target).catch(() => [] as string[]),
        resolve6(target).catch(() => [] as string[]),
      ]);
      addresses = v4.slice(0, MAX_DNSBL_ADDRESSES);
      skippedIpv6 = v6.slice(0, MAX_DNSBL_ADDRESSES);
    }

    const jobs = [
      ...(kind === 'domain'
        ? BLOCKLISTS.filter((l) => l.target === 'domain').map((list) => ({
            list,
            subject: target,
          }))
        : []),
      ...addresses.flatMap((ip) =>
        BLOCKLISTS.filter((l) => l.target === 'ip').map((list) => ({
          list,
          subject: ip,
        })),
      ),
    ];
    if (!jobs.length) {
      throw new NotFoundException(
        skippedIpv6.length
          ? 'Only IPv6 addresses: the blocklists checked here are IPv4-only.'
          : `${target} has no IPv4 address to check`,
      );
    }
    const checks = await mapConcurrent(jobs, 6, (j) =>
      checkList(j.list, j.subject, lookup),
    );
    return {
      query: target,
      kind,
      addresses,
      skippedIpv6,
      resolvers: servers,
      checks,
      findings: dnsblFindings(checks),
    };
  }
}
