import { BadGatewayException, Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import {
  MAX_EXPOSURE_ADDRESSES,
  type ExposureAddress,
  type PassiveExposureOutput,
  type PassiveExposureParams,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextLimited } from '../../core/http/read-limited.js';
import {
  publicResolver,
  resolveDomainAddresses,
} from '../../core/net/resolve-domain.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import {
  exposureFindings,
  parseInternetDb,
  riskyPorts,
} from './passive-exposure.parser.js';

const INTERNETDB = 'https://internetdb.shodan.io';
const MAX_BYTES = 512 * 1024;

/**
 * Passive: only Shodan's free InternetDB (and public DNS for domains) is queried;
 * the target itself is never contacted, so no TargetGuard is needed.
 */
@Injectable()
export class PassiveExposureService {
  constructor(private readonly http: HttpClientService) {}

  async lookup({
    target,
  }: PassiveExposureParams): Promise<PassiveExposureOutput> {
    const kind = isIP(target) ? 'ip' : 'domain';
    const ips =
      kind === 'ip'
        ? [target]
        : await resolveDomainAddresses(publicResolver(), target);

    const addresses = await mapConcurrent(
      ips.slice(0, MAX_EXPOSURE_ADDRESSES),
      4,
      (ip) => this.address(ip),
    );
    if (addresses.length && addresses.every((a) => a.error)) {
      throw new BadGatewayException(
        `Shodan InternetDB lookup failed: ${addresses[0]?.error}`,
      );
    }
    return {
      query: target,
      kind,
      resolvedCount: ips.length,
      source: 'Shodan InternetDB',
      addresses,
      findings: exposureFindings(addresses),
    };
  }

  private async address(ip: string): Promise<ExposureAddress> {
    const empty: ExposureAddress = {
      ip,
      indexed: false,
      ports: [],
      risky: [],
      cpes: [],
      hostnames: [],
      tags: [],
      vulns: [],
    };
    try {
      // `ip` comes from isIP()/DNS, so it is safe as a path segment.
      const res = await this.http.trusted(`${INTERNETDB}/${ip}`, {
        headers: { accept: 'application/json' },
        timeoutMs: 15_000,
      });
      if (res.status === 404) {
        await res.body?.cancel();
        return empty;
      }
      if (!res.ok) {
        await res.body?.cancel();
        return {
          ...empty,
          error:
            res.status === 429
              ? 'rate limited by InternetDB, try again in a minute'
              : `InternetDB responded ${res.status}`,
        };
      }
      const data = parseInternetDb(
        JSON.parse(await readTextLimited(res, MAX_BYTES)),
      );
      if (!data) return { ...empty, error: 'unexpected InternetDB response' };
      return { ip, indexed: true, ...data, risky: riskyPorts(data.ports) };
    } catch (err) {
      return { ...empty, error: (err as Error).message };
    }
  }
}
