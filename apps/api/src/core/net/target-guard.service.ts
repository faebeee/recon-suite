import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import type { Env } from '../../config/env.js';
import { isBlockedAddress } from './blocked-ranges.js';

export interface ResolvedTarget {
  host: string;
  addresses: string[];
}

/**
 * Gatekeeper for every outbound connection to a user-supplied target.
 * Any feature that connects to a target MUST go through this service
 * (directly, or via HttpClientService which uses `lookup`).
 */
@Injectable()
export class TargetGuardService {
  private readonly allowPrivate: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.allowPrivate = config.get('ALLOW_PRIVATE_TARGETS', { infer: true });
  }

  isAllowed(address: string): boolean {
    return this.allowPrivate || !isBlockedAddress(address);
  }

  /** Resolves a hostname (or validates an IP literal) and rejects blocked addresses. */
  async resolve(host: string): Promise<ResolvedTarget> {
    let addresses: string[];
    if (isIP(host)) {
      addresses = [host];
    } else {
      try {
        const results = await dnsLookup(host, { all: true, verbatim: true });
        addresses = results.map((r) => r.address);
      } catch {
        throw new NotFoundException(`Could not resolve host "${host}"`);
      }
    }

    const blocked = addresses.filter((a) => !this.isAllowed(a));
    if (blocked.length > 0) {
      throw new ForbiddenException(
        `Target "${host}" resolves to a private or reserved address (${blocked.join(', ')}). ` +
          'Set ALLOW_PRIVATE_TARGETS=true to allow internal targets.',
      );
    }
    return { host, addresses };
  }

  /**
   * Drop-in `lookup` for net/tls/undici sockets. Validates the address that is
   * actually connected to, which also covers redirects and DNS rebinding.
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
      (err: Error) => callback(Object.assign(err, { code: 'EBLOCKED' }), ''),
    );
  };
}
