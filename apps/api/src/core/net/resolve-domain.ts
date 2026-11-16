import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';

/** Public resolvers for passive lookups (the target's own DNS is never asked). */
export const PUBLIC_RESOLVERS = ['1.1.1.1', '1.0.0.1'];

export function publicResolver(): Resolver {
  const r = new Resolver({ timeout: 3000, tries: 2 });
  r.setServers(PUBLIC_RESOLVERS);
  return r;
}

/**
 * A and AAAA records of a domain (IPv4 first). Throws 404 for NXDOMAIN or no
 * address records, 502 for resolver failures, with messages meant for humans.
 */
export async function resolveDomainAddresses(
  r: Resolver,
  domain: string,
): Promise<string[]> {
  const [v4, v6] = await Promise.allSettled([
    r.resolve4(domain),
    r.resolve6(domain),
  ]);
  const ips = [
    ...(v4.status === 'fulfilled' ? v4.value : []),
    ...(v6.status === 'fulfilled' ? v6.value : []),
  ];
  if (ips.length) return ips;
  const codes = [v4, v6].map((s) =>
    s.status === 'rejected' ? (s.reason as NodeJS.ErrnoException).code : '',
  );
  if (codes.includes('ENOTFOUND')) {
    throw new NotFoundException(`NXDOMAIN: ${domain} does not exist`);
  }
  if (codes.every((c) => c === 'ENODATA')) {
    throw new NotFoundException(`${domain} has no A or AAAA records`);
  }
  throw new BadGatewayException(
    `Could not resolve ${domain} (${codes.join(', ')})`,
  );
}
