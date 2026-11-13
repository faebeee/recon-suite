import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { fetch as undiciFetch } from 'undici';
import type { ReverseIpOutput, ReverseIpParams } from '@recon/shared';
import type { Env } from '../../config/env.js';
import { readTextLimited } from '../../core/http/read-limited.js';
import {
  mapDomainsList,
  type StDomainsListResponse,
} from './securitytrails.mapper.js';

const ST_DOMAINS_LIST = 'https://api.securitytrails.com/v1/domains/list';
const RESOLVERS = ['1.1.1.1', '1.0.0.1'];
const TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export type FetchLike = typeof undiciFetch;

/**
 * Passive: asks SecurityTrails which hostnames point at an IP. The target is never
 * contacted. HttpClientService.trusted() cannot send a request body yet, so this service
 * calls undici's fetch directly, only for the fixed SecurityTrails URL above, with a
 * timeout, no redirects and a response size limit.
 */
@Injectable()
export class ReverseIpService {
  /** Replaced in tests. */
  fetchImpl: FetchLike = undiciFetch;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async lookup({ target }: ReverseIpParams): Promise<ReverseIpOutput> {
    const apiKey = this.config.get('SECURITYTRAILS_API_KEY', { infer: true });
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Reverse IP needs a SecurityTrails API key; set SECURITYTRAILS_API_KEY.',
      );
    }

    const isDomain = !isIP(target);
    const ip = isDomain ? await resolveFirst(target) : target;
    // The filter API takes ipv4 and ipv6 keys (SecurityTrails "Search Domain (filter)").
    const filter = isIP(ip) === 6 ? { ipv6: ip } : { ipv4: ip };
    const body = await this.post(apiKey, { filter });
    return {
      ip,
      ...(isDomain && { resolvedFrom: target }),
      source: 'securitytrails',
      ...mapDomainsList(body),
    };
  }

  private async post(
    apiKey: string,
    payload: unknown,
  ): Promise<StDomainsListResponse> {
    let text: string;
    try {
      const res = await this.fetchImpl(ST_DOMAINS_LIST, {
        method: 'POST',
        redirect: 'error',
        headers: {
          APIKEY: apiKey,
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'recon-suite/0.1 (+security-recon)',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        const detail = await readTextLimited(res, 16 * 1024).catch(() => '');
        throw securityTrailsError(res.status, detail);
      }
      text = await readTextLimited(res, MAX_RESPONSE_BYTES);
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw new BadGatewayException(
          'SecurityTrails returned an oversized response',
        );
      }
      if (err instanceof HttpException) throw err;
      if (
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')
      ) {
        throw new GatewayTimeoutException(
          'SecurityTrails did not answer within 20 s',
        );
      }
      throw new BadGatewayException(
        `Request to SecurityTrails failed: ${(err as Error).message}`,
      );
    }
    try {
      return JSON.parse(text) as StDomainsListResponse;
    } catch {
      throw new BadGatewayException(
        'SecurityTrails returned an invalid response',
      );
    }
  }
}

export function securityTrailsError(
  status: number,
  body: string,
): HttpException {
  if (status === 401 || status === 403) {
    return new BadGatewayException(
      'SecurityTrails rejected the API key (or the plan does not include domain search). Check SECURITYTRAILS_API_KEY.',
    );
  }
  if (status === 429) {
    return new ServiceUnavailableException(
      'SecurityTrails rate limit or monthly quota reached. Try again later.',
    );
  }
  if (status === 400) {
    let message = '';
    try {
      message = (JSON.parse(body) as { message?: string }).message ?? '';
    } catch {
      // not JSON
    }
    return new BadRequestException(
      `SecurityTrails rejected the query${message ? `: ${message}` : ''}`,
    );
  }
  return new BadGatewayException(`SecurityTrails responded ${status}`);
}

/** First A record via a public resolver, falling back to AAAA. */
async function resolveFirst(domain: string): Promise<string> {
  const r = new Resolver({ timeout: 3000, tries: 2 });
  r.setServers(RESOLVERS);
  const codes: (string | undefined)[] = [];
  for (const lookup of [r.resolve4.bind(r), r.resolve6.bind(r)]) {
    try {
      const ips = await lookup(domain);
      if (ips[0]) return ips[0];
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOTFOUND') {
        throw new NotFoundException(`NXDOMAIN: ${domain} does not exist`);
      }
      codes.push(code);
    }
  }
  if (codes.every((c) => c === 'ENODATA')) {
    throw new NotFoundException(`${domain} has no A or AAAA records`);
  }
  throw new BadGatewayException(
    `Could not resolve ${domain} (${codes.join(', ')})`,
  );
}
