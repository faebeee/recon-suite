import {
  BadGatewayException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import { isIPv4 } from 'node:net';
import type {
  Finding,
  ZoneTransferAttempt,
  ZoneTransferOutput,
  ZoneTransferParams,
} from '@recon/shared';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import { axfr } from './axfr-client.js';

const RESOLVERS = ['1.1.1.1', '1.0.0.1'];
const MAX_NAMESERVERS = 6;

export type NsLookup = (domain: string) => Promise<string[]>;

/** NS records via a public resolver; maps DNS errors to HTTP exceptions. */
export const lookupNameservers: NsLookup = async (domain) => {
  const r = new Resolver({ timeout: 3000, tries: 2 });
  r.setServers(RESOLVERS);
  try {
    return await r.resolveNs(domain);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND') {
      throw new NotFoundException(`NXDOMAIN: ${domain} does not exist`);
    }
    if (code === 'ENODATA') return [];
    throw new BadGatewayException(
      `NS lookup for ${domain} failed (${code ?? 'unknown error'})`,
    );
  }
};

@Injectable()
export class ZoneTransferService {
  /** Replaceable in tests (no internet there). */
  lookupNs: NsLookup = lookupNameservers;
  port = 53;
  timeoutMs = 10_000;

  constructor(private readonly guard: TargetGuardService) {}

  async transfer({ target }: ZoneTransferParams): Promise<ZoneTransferOutput> {
    const domain = target.toLowerCase().replace(/\.$/, '');
    const nameservers = [
      ...new Set(
        (await this.lookupNs(domain)).map((n) =>
          n.toLowerCase().replace(/\.$/, ''),
        ),
      ),
    ]
      .sort()
      .slice(0, MAX_NAMESERVERS);
    if (nameservers.length === 0) {
      throw new NotFoundException(
        `${domain} has no NS records. Enter the zone apex (e.g. example.com, not www.example.com).`,
      );
    }

    const attempts = await mapConcurrent(nameservers, MAX_NAMESERVERS, (ns) =>
      this.attempt(ns, domain),
    );
    return { domain, attempts, findings: buildZoneFindings(domain, attempts) };
  }

  private async attempt(
    nameserver: string,
    domain: string,
  ): Promise<ZoneTransferAttempt> {
    let address: string;
    try {
      const { addresses } = await this.guard.resolve(nameserver);
      address = addresses.find((a) => isIPv4(a)) ?? addresses[0]!;
    } catch (err) {
      return {
        nameserver,
        status: 'error',
        error:
          err instanceof HttpException || err instanceof Error
            ? err.message
            : String(err),
      };
    }
    const result = await axfr(address, domain, {
      port: this.port,
      timeoutMs: this.timeoutMs,
    });
    return { nameserver, address, ...result };
  }
}

export function buildZoneFindings(
  domain: string,
  attempts: ZoneTransferAttempt[],
): Finding[] {
  const allowed = attempts.filter((a) => a.status === 'allowed');
  if (allowed.length) {
    return allowed.map((a) => ({
      id: `axfr.${a.nameserver}`,
      status: 'fail',
      title: 'Zone transfer allowed',
      message: `Zone transfer allowed by ${a.nameserver}: anyone can download all ${a.recordCount ?? 0} records of ${domain}. Restrict AXFR to your secondary nameservers (allow-transfer / TSIG).`,
      value: a.address,
    }));
  }
  if (attempts.some((a) => a.status === 'refused')) {
    return [
      {
        id: 'axfr.refused',
        status: 'pass',
        title: 'Zone transfer refused',
        message: `No nameserver of ${domain} allowed a zone transfer.`,
      },
    ];
  }
  return [
    {
      id: 'axfr.untested',
      status: 'info',
      title: 'Zone transfer not tested',
      message:
        'No nameserver could be reached, so it is unknown whether AXFR is restricted.',
    },
  ];
}
