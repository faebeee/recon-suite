import { Injectable, NotFoundException } from '@nestjs/common';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';

export interface ResolvedTarget {
  host: string;
  addresses: string[];
}

/**
 * Resolves user-supplied targets for outbound connections. Features that connect to a
 * target go through this service (directly, or via HttpClientService which uses `lookup`)
 * so they connect to the resolved IP. Private, loopback and reserved addresses are allowed.
 */
@Injectable()
export class TargetGuardService {
  /** Resolves a hostname (or passes an IP literal through). */
  async resolve(host: string): Promise<ResolvedTarget> {
    if (isIP(host)) return { host, addresses: [host] };
    try {
      const results = await dnsLookup(host, { all: true, verbatim: true });
      return { host, addresses: results.map((r) => r.address) };
    } catch {
      throw new NotFoundException(`Could not resolve host "${host}"`);
    }
  }

  /**
   * Drop-in `lookup` for net/tls/undici sockets. Resolve failures carry the code
   * `ENOTRESOLVED` so HttpClientService can answer 404 instead of 502.
   */
  readonly lookup: LookupFunction = (hostname, options, callback) => {
    this.resolve(hostname).then(
      ({ addresses }) => {
        if (options.all) {
          callback(
            null,
            addresses.map((address) => ({ address, family: isIP(address) })),
          );
        } else {
          const address = addresses[0]!;
          callback(null, address, isIP(address));
        }
      },
      (err: Error) =>
        callback(Object.assign(err, { code: 'ENOTRESOLVED' }), ''),
    );
  };
}
