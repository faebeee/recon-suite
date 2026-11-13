import { Injectable } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import type {
  BucketResult,
  CloudStorageOutput,
  CloudStorageParams,
} from '@recon/shared';
import type { Response } from 'undici';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextPrefix } from '../../core/http/read-limited.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import {
  azureAccountName,
  baseName,
  buildCloudFindings,
  candidateNames,
  interpretGcs,
  interpretS3,
  parseAzureBlobNames,
  type StateVerdict,
} from './cloud-storage.parser.js';

const CONCURRENCY = 6;
const TIMEOUT_MS = 8000;
const MAX_BODY = 64 * 1024;
const REGION = /^[a-z0-9-]{4,30}$/;

type Check = () => Promise<BucketResult>;

/** Returns true when the name resolves, false on NXDOMAIN; throws otherwise. */
export type HostExists = (host: string) => Promise<boolean>;

const dnsExists: HostExists = async (host) => {
  const r = new Resolver({ timeout: 3000, tries: 2 });
  r.setServers(['1.1.1.1', '1.0.0.1']);
  try {
    await r.resolve4(host);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND') return false;
    // The name exists but has no A record (e.g. only AAAA/CNAME chain without A).
    if (code === 'ENODATA') return true;
    throw err;
  }
};

@Injectable()
export class CloudStorageService {
  /** DNS existence check; replaced by a fake in tests. */
  hostExists: HostExists = dnsExists;

  constructor(private readonly http: HttpClientService) {}

  async scan({
    target,
    extraNames,
  }: CloudStorageParams): Promise<CloudStorageOutput> {
    const names = candidateNames(target, extraNames);
    const base = baseName(target);

    const checks: Check[] = [];
    const accounts = new Set<string>();
    for (const name of names) {
      checks.push(
        () => this.s3(name),
        () => this.gcs(name),
      );
      const acct = azureAccountName(name);
      if (acct && !accounts.has(acct)) {
        accounts.add(acct);
        checks.push(() => this.azure(name, acct, base));
      }
    }

    const all = await mapConcurrent(checks, CONCURRENCY, (check) => check());
    const results = all.filter((r) => r.state !== 'not-found');
    return {
      names,
      results,
      checked: checks.length,
      findings: buildCloudFindings(results),
    };
  }

  private async get(
    url: string,
  ): Promise<{ status: number; body: string; headers: Response['headers'] }> {
    const res = await this.http.target(url, {
      redirect: 'manual',
      timeoutMs: TIMEOUT_MS,
    });
    const { text } = await readTextPrefix(res, MAX_BODY);
    return { status: res.status, body: text, headers: res.headers };
  }

  private async s3(name: string): Promise<BucketResult> {
    const url = `https://s3.amazonaws.com/${name}`;
    return this.guarded('s3', name, url, async () => {
      const r = await this.get(url);
      const v = interpretS3(r.status, r.body);
      if (v.kind === 'state') return fromVerdict('s3', name, url, r.status, v);
      // Bucket lives in another region: retry once at the regional endpoint.
      const region = r.headers.get('x-amz-bucket-region') ?? '';
      if (!REGION.test(region)) {
        return {
          provider: 's3',
          name,
          url,
          state: 'exists-private',
          status: r.status,
        };
      }
      const regional = `https://s3.${region}.amazonaws.com/${name}`;
      const r2 = await this.get(regional);
      const v2 = interpretS3(r2.status, r2.body);
      return v2.kind === 'state'
        ? fromVerdict('s3', name, regional, r2.status, v2)
        : {
            provider: 's3',
            name,
            url: regional,
            state: 'exists-private',
            status: r2.status,
          };
    });
  }

  private gcs(name: string): Promise<BucketResult> {
    const url = `https://storage.googleapis.com/${name}`;
    return this.guarded('gcs', name, url, async () => {
      const r = await this.get(url);
      return fromVerdict(
        'gcs',
        name,
        url,
        r.status,
        interpretGcs(r.status, r.body),
      );
    });
  }

  private azure(
    name: string,
    acct: string,
    base: string,
  ): Promise<BucketResult> {
    const host = `${acct}.blob.core.windows.net`;
    const url = `https://${host}`;
    return this.guarded('azure', acct, url, async () => {
      if (!(await this.hostExists(host))) {
        return { provider: 'azure', name: acct, url, state: 'not-found' };
      }
      const containers = [...new Set([base, 'public', 'assets'])].filter((c) =>
        /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(c),
      );
      for (const container of containers.slice(0, 3)) {
        const listUrl = `${url}/${container}?restype=container&comp=list`;
        // A failing container probe should not hide that the account exists.
        const r = await this.get(listUrl).catch(() => undefined);
        if (r?.status === 200 && r.body.includes('<EnumerationResults')) {
          return {
            provider: 'azure',
            name: `${acct}/${container}`,
            url: listUrl,
            state: 'public-list',
            status: 200,
            sampleKeys: parseAzureBlobNames(r.body),
          };
        }
      }
      return { provider: 'azure', name: acct, url, state: 'exists-private' };
    });
  }

  /** Runs one check; failures become an `error` result instead of failing the scan. */
  private async guarded(
    provider: BucketResult['provider'],
    name: string,
    url: string,
    fn: () => Promise<BucketResult>,
  ): Promise<BucketResult> {
    try {
      return await fn();
    } catch (err) {
      return {
        provider,
        name,
        url,
        state: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

function fromVerdict(
  provider: BucketResult['provider'],
  name: string,
  url: string,
  status: number,
  v: StateVerdict,
): BucketResult {
  const r: BucketResult = { provider, name, url, state: v.state, status };
  if (v.sampleKeys) r.sampleKeys = v.sampleKeys;
  if (v.state === 'error') r.error = `Unexpected response ${status}`;
  return r;
}
