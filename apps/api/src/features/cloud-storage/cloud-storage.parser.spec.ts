import {
  azureAccountName,
  baseName,
  buildCloudFindings,
  candidateNames,
  interpretGcs,
  interpretS3,
  MAX_CANDIDATES,
  parseAzureBlobNames,
  parseListBucketKeys,
  xmlErrorCode,
} from './cloud-storage.parser.js';

describe('candidateNames', () => {
  it('derives names from the domain', () => {
    const names = candidateNames('www.example.co.uk');
    expect(baseName('www.example.co.uk')).toBe('example');
    expect(names[0]).toBe('example');
    expect(names).toContain('example-backup');
    expect(names).toContain('example-logs');
    expect(names).toContain('example-co-uk');
    expect(names).toHaveLength(16);
  });

  it('adds and dedupes extra names, drops invalid ones and caps the list', () => {
    const names = candidateNames('example.com', ['Example', 'acme-data', 'x']);
    expect(names.filter((n) => n === 'example')).toHaveLength(1);
    expect(names).toContain('acme-data');
    expect(names).not.toContain('x');
    const many = candidateNames(
      'example.com',
      Array.from({ length: 20 }, (_, i) => `extra-${i}`),
    );
    expect(many).toHaveLength(MAX_CANDIDATES);
  });

  it('skips a base that is too short for a bucket name', () => {
    const names = candidateNames('x.io');
    expect(names).not.toContain('x');
    expect(names).toContain('x-backup');
    expect(names).toContain('x-io');
  });
});

describe('azureAccountName', () => {
  it('strips separators and validates length', () => {
    expect(azureAccountName('example-backup')).toBe('examplebackup');
    expect(azureAccountName('a-b')).toBeUndefined();
    expect(azureAccountName('a'.repeat(25))).toBeUndefined();
  });
});

describe('XML parsing', () => {
  it('reads keys, blob names and error codes', () => {
    expect(
      parseListBucketKeys(
        '<ListBucketResult><Contents><Key>a&amp;b.txt</Key></Contents><Contents><Key>c</Key></Contents></ListBucketResult>',
      ),
    ).toEqual(['a&b.txt', 'c']);
    expect(
      parseListBucketKeys(
        '<ListBucketResult>' +
          '<Key>k</Key>'.repeat(15) +
          '</ListBucketResult>',
      ),
    ).toHaveLength(10);
    expect(
      parseAzureBlobNames(
        '<EnumerationResults><Blobs><Blob><Name>x.png</Name></Blob></Blobs></EnumerationResults>',
      ),
    ).toEqual(['x.png']);
    expect(xmlErrorCode('<Error><Code>NoSuchBucket</Code></Error>')).toBe(
      'NoSuchBucket',
    );
  });
});

describe('interpretS3', () => {
  it('maps responses to states', () => {
    expect(
      interpretS3(200, '<ListBucketResult><Key>a</Key></ListBucketResult>'),
    ).toEqual({ kind: 'state', state: 'public-list', sampleKeys: ['a'] });
    expect(
      interpretS3(403, '<Error><Code>AccessDenied</Code></Error>'),
    ).toEqual({
      kind: 'state',
      state: 'exists-private',
    });
    expect(
      interpretS3(403, '<Error><Code>AllAccessDisabled</Code></Error>'),
    ).toMatchObject({ state: 'exists-private' });
    expect(
      interpretS3(404, '<Error><Code>NoSuchBucket</Code></Error>'),
    ).toMatchObject({
      state: 'not-found',
    });
    expect(
      interpretS3(301, '<Error><Code>PermanentRedirect</Code></Error>'),
    ).toEqual({ kind: 'redirect' });
    expect(interpretS3(500, '')).toMatchObject({ state: 'error' });
  });
});

describe('interpretGcs', () => {
  it('maps responses to states', () => {
    expect(
      interpretGcs(200, '<ListBucketResult><Key>a</Key></ListBucketResult>'),
    ).toMatchObject({ state: 'public-list' });
    expect(interpretGcs(401, '')).toMatchObject({ state: 'exists-private' });
    expect(interpretGcs(403, '')).toMatchObject({ state: 'exists-private' });
    expect(interpretGcs(404, '')).toMatchObject({ state: 'not-found' });
    expect(interpretGcs(502, '')).toMatchObject({ state: 'error' });
  });
});

describe('buildCloudFindings', () => {
  it('fails public buckets and summarises private ones', () => {
    const f = buildCloudFindings([
      { provider: 's3', name: 'a', url: 'u1', state: 'public-list' },
      { provider: 'gcs', name: 'b', url: 'u2', state: 'exists-private' },
      { provider: 'azure', name: 'c', url: 'u3', state: 'exists-private' },
    ]);
    expect(f.map((x) => `${x.id}:${x.status}`)).toEqual([
      'cloud.public.s3.a:fail',
      'cloud.existing:info',
    ]);
    expect(f[0]?.message).toContain('Bucket a allows anonymous listing');
    expect(f[1]?.value).toBe('gcs:b, azure:c');
  });

  it('passes when nothing is public', () => {
    expect(buildCloudFindings([])).toEqual([
      expect.objectContaining({ id: 'cloud.public', status: 'pass' }),
    ]);
  });
});
