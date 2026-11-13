import {
  analyzeWayback,
  cdxTimestampToIso,
  extensionOf,
  interestingReason,
  MAX_INTERESTING,
  parseCdxRows,
  toArchivedUrls,
} from './wayback.parser.js';

const HEADER = ['original', 'timestamp', 'statuscode', 'mimetype'];

describe('parseCdxRows', () => {
  it('drops the header row and ignores malformed rows', () => {
    expect(
      parseCdxRows([
        HEADER,
        ['http://x.test/', '20200101000000', '200', 'text/html'],
        'junk',
        [1, 2],
      ]),
    ).toEqual([['http://x.test/', '20200101000000', '200', 'text/html']]);
  });
  it('accepts an empty result', () => {
    expect(parseCdxRows([])).toEqual([]);
  });
  it('rejects non-arrays', () => {
    expect(() => parseCdxRows({ error: 'x' })).toThrow();
  });
});

describe('cdxTimestampToIso', () => {
  it('converts full and short timestamps', () => {
    expect(cdxTimestampToIso('20210304050607')).toBe(
      '2021-03-04T05:06:07.000Z',
    );
    expect(cdxTimestampToIso('2019')).toBe('2019-01-01T00:00:00.000Z');
    expect(cdxTimestampToIso('nope')).toBe('nope');
  });
});

describe('toArchivedUrls', () => {
  it('dedupes by URL keeping the latest capture and parses status/mime', () => {
    expect(
      toArchivedUrls([
        ['http://x.test/a', '20200101000000', '200', 'text/html'],
        ['http://x.test/a', '20220101000000', '-', 'warc/revisit'],
        ['http://x.test/b', '20210101000000', '404', 'unk'],
        ['', '2021', '200', 'x'],
      ]),
    ).toEqual([
      {
        url: 'http://x.test/a',
        lastSeen: '2022-01-01T00:00:00.000Z',
        mimeType: 'warc/revisit',
      },
      {
        url: 'http://x.test/b',
        lastSeen: '2021-01-01T00:00:00.000Z',
        status: 404,
      },
    ]);
  });
});

describe('interestingReason', () => {
  it.each([
    ['https://x.test/site.bak', 'backup file'],
    ['https://x.test/index.php~', 'backup file'],
    ['https://x.test/dump.tar.gz', 'backup file'],
    ['https://x.test/db.sqlite', 'backup file'],
    ['https://x.test/.env', 'secret file'],
    ['https://x.test/.env.production', 'secret file'],
    ['https://x.test/certs/server.pem', 'secret file'],
    ['https://x.test/logs/error.log', 'log file'],
    ['https://x.test/web.config', 'config file'],
    ['https://x.test/docker-compose.yml', 'config file'],
    ['https://x.test/config/app.json', 'config file'],
    ['https://x.test/appsettings.json', 'config file'],
    ['https://x.test/reset?token=abc', 'token in query'],
    ['https://x.test/api?API_KEY=1', 'api_key in query'],
    ['https://x.test/wp-admin/', 'admin/debug path'],
    ['https://x.test/actuator/env', 'admin/debug path'],
    ['https://x.test/.git/config', 'admin/debug path'],
    ['https://x.test/graphql', 'admin/debug path'],
  ])('%s -> %s', (url, reason) => {
    expect(interestingReason(url)).toBe(reason);
  });

  it.each([
    'https://x.test/',
    'https://x.test/api/users.json',
    'https://x.test/administration-guide',
    'https://x.test/search?q=key',
    'not a url',
  ])('%s is not interesting', (url) => {
    expect(interestingReason(url)).toBeUndefined();
  });
});

describe('extensionOf', () => {
  it('reads the last segment extension', () => {
    expect(extensionOf('https://x.test/a/b.PHP?x=1')).toBe('php');
    expect(extensionOf('https://x.test/a.tar.gz')).toBe('tar.gz');
    expect(extensionOf('https://x.test/a/')).toBeUndefined();
  });
});

describe('analyzeWayback', () => {
  it('builds stats and flags truncation', () => {
    const rows = [
      ['http://x.test/a.php?id=1&q=2', '20200101000000', '200', 'text/html'],
      ['http://x.test/b.php?id=3', '20200101000000', '200', 'text/html'],
      ['http://x.test/c.js', '20200101000000', '200', 'application/javascript'],
      ['http://x.test/backup.zip', '20200101000000', '200', 'application/zip'],
    ];
    const out = analyzeWayback('x.test', rows, 4);
    expect(out).toMatchObject({
      domain: 'x.test',
      source: 'web.archive.org',
      total: 4,
      truncated: true,
      interesting: [{ url: 'http://x.test/backup.zip', reason: 'backup file' }],
      parameters: [
        { name: 'id', count: 2 },
        { name: 'q', count: 1 },
      ],
      extensions: [
        { ext: 'php', count: 2 },
        { ext: 'js', count: 1 },
        { ext: 'zip', count: 1 },
      ],
    });
    expect(analyzeWayback('x.test', rows, 1000).truncated).toBe(false);
  });

  it('caps interesting URLs', () => {
    const rows = Array.from({ length: MAX_INTERESTING + 20 }, (_, i) => [
      `http://x.test/f${i}.bak`,
      '2020',
      '200',
      'x',
    ]);
    expect(analyzeWayback('x.test', rows, 5000).interesting).toHaveLength(
      MAX_INTERESTING,
    );
  });
});
