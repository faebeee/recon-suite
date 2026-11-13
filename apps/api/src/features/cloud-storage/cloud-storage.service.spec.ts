import { ForbiddenException } from '@nestjs/common';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { CloudStorageService } from './cloud-storage.service.js';

const xml = (
  body: string,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'application/xml', ...headers },
  });
const notFoundS3 = () => xml('<Error><Code>NoSuchBucket</Code></Error>', 404);

function setup(
  routes: Record<string, () => Response>,
  existing: string[] = [],
) {
  const target = vi.fn(async (url: string, opts?: { redirect?: string }) => {
    expect(opts?.redirect).toBe('manual');
    if (url.includes('blocked')) throw new ForbiddenException('blocked');
    const route = routes[url];
    if (route) return route();
    if (url.startsWith('https://s3.')) return notFoundS3();
    return new Response('', { status: 404 });
  });
  const svc = new CloudStorageService({
    target,
  } as unknown as HttpClientService);
  const hostExists = vi.fn(async (host: string) => existing.includes(host));
  svc.hostExists = hostExists;
  return { svc, target, hostExists };
}

describe('CloudStorageService', () => {
  it('detects public, private and regional S3 buckets, GCS and Azure', async () => {
    const { svc, target } = setup(
      {
        'https://s3.amazonaws.com/example': () =>
          xml(
            '<ListBucketResult><Contents><Key>secret.sql</Key></Contents></ListBucketResult>',
          ),
        'https://s3.amazonaws.com/example-backup': () =>
          xml('<Error><Code>AccessDenied</Code></Error>', 403),
        'https://s3.amazonaws.com/example-assets': () =>
          xml('<Error><Code>PermanentRedirect</Code></Error>', 301, {
            'x-amz-bucket-region': 'eu-west-1',
          }),
        'https://s3.eu-west-1.amazonaws.com/example-assets': () =>
          xml('<ListBucketResult></ListBucketResult>'),
        'https://storage.googleapis.com/example-media': () => xml('', 403),
        'https://examplestatic.blob.core.windows.net/public?restype=container&comp=list':
          () =>
            xml(
              '<EnumerationResults><Blobs><Blob><Name>logo.png</Name></Blob></Blobs></EnumerationResults>',
            ),
      },
      [
        'examplestatic.blob.core.windows.net',
        'exampledev.blob.core.windows.net',
      ],
    );
    const out = await svc.scan({ target: 'example.com', extraNames: [] });

    expect(out.names).toHaveLength(16);
    // 16 names x (S3 + GCS) + 16 distinct Azure accounts
    expect(out.checked).toBe(48);
    const summary = out.results.map(
      (r) => `${r.provider}:${r.name}:${r.state}`,
    );
    expect([...summary].sort()).toEqual(
      [
        's3:example:public-list',
        's3:example-backup:exists-private',
        's3:example-assets:public-list',
        'azure:examplestatic/public:public-list',
        'gcs:example-media:exists-private',
        'azure:exampledev:exists-private',
      ].sort(),
    );
    expect(out.results.find((r) => r.name === 'example')?.sampleKeys).toEqual([
      'secret.sql',
    ]);
    expect(out.results.find((r) => r.name === 'example-assets')?.url).toBe(
      'https://s3.eu-west-1.amazonaws.com/example-assets',
    );
    expect(out.findings.filter((f) => f.status === 'fail')).toHaveLength(3);
    // Azure listing only for existing accounts, max 3 containers each.
    const azureCalls = target.mock.calls.filter(([u]) =>
      u.includes('blob.core'),
    );
    expect(azureCalls.length).toBeLessThanOrEqual(6);
  });

  it('reports per-check failures as errors without failing the scan', async () => {
    const { svc } = setup({});
    const out = await svc.scan({
      target: 'example.com',
      extraNames: ['blocked-name'],
    });
    const errors = out.results.filter((r) => r.state === 'error');
    expect(errors.map((r) => `${r.provider}:${r.name}`)).toEqual([
      's3:blocked-name',
      'gcs:blocked-name',
    ]);
    expect(errors[0]?.error).toBe('blocked');
    expect(out.findings).toEqual([
      expect.objectContaining({ id: 'cloud.public', status: 'pass' }),
    ]);
  });

  it('turns DNS failures into an Azure error result', async () => {
    const { svc } = setup({});
    svc.hostExists = vi.fn(async () => {
      throw new Error('ETIMEOUT');
    });
    const out = await svc.scan({ target: 'example.com', extraNames: [] });
    expect(
      out.results.every((r) => r.provider === 'azure' && r.state === 'error'),
    ).toBe(true);
  });
});
