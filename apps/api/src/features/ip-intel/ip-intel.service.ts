import { Injectable } from '@nestjs/common';
import type { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import {
  MAX_IP_INTEL_ADDRESSES,
  type IpIntelAddress,
  type IpIntelOutput,
  type IpIntelParams,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import {
  publicResolver,
  resolveDomainAddresses,
} from '../../core/net/resolve-domain.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import {
  canonicalIp,
  cymruOriginName,
  parseCymruAsName,
  parseCymruOrigin,
  parseRdapNetwork,
  providerForAsn,
  type RdapIpNetwork,
} from './ip-intel.parser.js';

const RDAP_BOOTSTRAP = 'https://rdap.org';
const MAX_PTR_CONFIRM = 3;

/**
 * Passive: only DNS (public resolver, Team Cymru) and RDAP are queried; the target
 * itself is never contacted, so no TargetGuard is needed.
 */
@Injectable()
export class IpIntelService {
  constructor(private readonly http: HttpClientService) {}

  async lookup({ target }: IpIntelParams): Promise<IpIntelOutput> {
    const r = publicResolver();

    const kind = isIP(target) ? 'ip' : 'domain';
    const ips =
      kind === 'ip' ? [target] : await resolveDomainAddresses(r, target);

    const addresses = await mapConcurrent(
      ips.slice(0, MAX_IP_INTEL_ADDRESSES),
      4,
      (ip) => this.analyse(r, ip),
    );
    return { query: target, kind, resolvedCount: ips.length, addresses };
  }

  private async analyse(r: Resolver, ip: string): Promise<IpIntelAddress> {
    const errors: string[] = [];
    const note = (what: string) => (err: unknown) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOTFOUND' && code !== 'ENODATA') {
        errors.push(`${what}: ${code ?? (err as Error).message}`);
      }
      return undefined;
    };

    const [ptr, origin, network] = await Promise.all([
      r.reverse(ip).catch(note('reverse DNS')),
      r
        .resolveTxt(cymruOriginName(ip))
        .then((t) => parseCymruOrigin(t[0]?.join('') ?? ''))
        .catch(note('ASN lookup')),
      this.rdap(ip).catch((err: unknown) => {
        errors.push(`RDAP: ${(err as Error).message}`);
        return undefined;
      }),
    ]);

    if (origin) {
      origin.name = await r
        .resolveTxt(`AS${origin.number}.asn.cymru.com`)
        .then((t) => parseCymruAsName(t[0]?.join('') ?? ''))
        .catch(note('AS name'));
    }

    const ptrNames = ptr ?? [];
    return {
      ip,
      version: isIP(ip) === 6 ? 6 : 4,
      ptr: ptrNames,
      forwardConfirmed: ptrNames.length
        ? await this.forwardConfirmed(r, ip, ptrNames)
        : null,
      asn: origin,
      network,
      provider: providerForAsn(origin?.number),
      errors,
    };
  }

  private async forwardConfirmed(r: Resolver, ip: string, names: string[]) {
    const want = canonicalIp(ip);
    const lookup = isIP(ip) === 6 ? r.resolve6.bind(r) : r.resolve4.bind(r);
    const results = await Promise.all(
      names.slice(0, MAX_PTR_CONFIRM).map((n) => lookup(n).catch(() => [])),
    );
    return results.flat().some((a) => canonicalIp(a) === want);
  }

  private async rdap(ip: string) {
    // `ip` comes from isIP()/DNS; rdap.org rejects percent-encoded IPv6 colons.
    const url = `${RDAP_BOOTSTRAP}/ip/${ip}`;
    const res = await this.http.trusted(url, {
      headers: { accept: 'application/rdap+json, application/json' },
      timeoutMs: 15_000,
    });
    if (!res.ok) {
      await res.body?.cancel();
      if (res.status === 404) return undefined;
      throw new Error(`rdap.org responded ${res.status}`);
    }
    return parseRdapNetwork((await res.json()) as RdapIpNetwork);
  }
}
