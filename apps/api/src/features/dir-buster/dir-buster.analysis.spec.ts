import {
  candidates,
  dirBusterFindings,
  extensionOf,
  extractTitle,
  isDirectoryListing,
  matchesBaseline,
  normalizeLocation,
  scanBase,
  toHit,
  uniqueWords,
  withDirectoryResponse,
} from './dir-buster.analysis.js';

describe('dir-buster analysis', () => {
  it('scans below the target path as a directory', () => {
    expect(scanBase('https://x.test')).toBe('https://x.test/');
    expect(scanBase('https://x.test/app?q=1#top')).toBe('https://x.test/app/');
    expect(scanBase('https://x.test/app/')).toBe('https://x.test/app/');
  });

  it('builds candidates per word and extension', () => {
    expect(candidates(['admin', 'backup'], ['php', 'zip'])).toEqual([
      'admin',
      'admin.php',
      'admin.zip',
      'backup',
      'backup.php',
      'backup.zip',
    ]);
    expect(extensionOf('backup.zip', ['php', 'zip'])).toBe('zip');
    expect(extensionOf('robots.txt', ['php'])).toBe('');
    expect(uniqueWords(['a', 'b'], ['b', ' c '])).toEqual(['a', 'b', 'c']);
  });

  it('treats responses like the random-path baseline as not found', () => {
    const spa = { status: 200, length: 1500 };
    expect(
      matchesBaseline({ status: 200, length: 1510 }, 'admin', spa, 'rsX'),
    ).toBe(true);
    expect(
      matchesBaseline({ status: 200, length: 9000 }, 'admin', spa, 'rsX'),
    ).toBe(false);
    expect(
      matchesBaseline({ status: 403, length: 1500 }, 'admin', spa, 'rsX'),
    ).toBe(false);
    // Catch-all redirect to a login page that echoes the requested path.
    const login = { status: 302, location: 'https://x.test/login?next=/rsX' };
    expect(
      matchesBaseline(
        { status: 302, location: 'https://x.test/login?next=/admin' },
        'admin',
        login,
        'rsX',
      ),
    ).toBe(true);
    expect(normalizeLocation('/a/rsX/b', 'rsX')).toBe('/a/{}/b');
    expect(matchesBaseline({ status: 200 }, 'admin', undefined, 'rsX')).toBe(
      false,
    );
  });

  it('classifies directories, files, redirects and listings', () => {
    expect(toHit('https://x.test/', 'nope', { status: 404 }, 1)).toBeNull();
    expect(
      toHit(
        'https://x.test/',
        'admin',
        { status: 301, location: 'https://x.test/admin/' },
        1,
      ),
    ).toMatchObject({
      path: '/admin/',
      url: 'https://x.test/admin/',
      kind: 'directory',
    });
    const file = toHit(
      'https://x.test/app/',
      'login',
      {
        status: 302,
        location: 'https://sso.x.test/auth',
        contentType: 'text/html',
      },
      2,
    );
    expect(file).toMatchObject({
      path: '/app/login',
      kind: 'file',
      redirect: 'https://sso.x.test/auth',
      depth: 2,
    });
    const listing = toHit(
      'https://x.test/',
      'files',
      { status: 200, body: '<title>Index of /files</title>', length: 30 },
      1,
    );
    expect(listing).toMatchObject({
      kind: 'directory',
      listing: true,
      path: '/files/',
      title: 'Index of /files',
    });
  });

  it('extracts titles and detects directory indexes', () => {
    expect(extractTitle('<html><title>\n  Admin   Login </title>')).toBe(
      'Admin Login',
    );
    expect(extractTitle('no title')).toBeUndefined();
    expect(isDirectoryListing('<h1>Index of /backup</h1>')).toBe(true);
    expect(isDirectoryListing('[To Parent Directory]')).toBe(true);
    expect(isDirectoryListing('<title>Shop</title>')).toBe(false);
  });

  it('warns about listings and backups, the rest is information', () => {
    const findings = dirBusterFindings([
      {
        path: '/files/',
        url: '',
        status: 200,
        kind: 'directory',
        listing: true,
        depth: 1,
      },
      { path: '/site.zip', url: '', status: 200, kind: 'file', depth: 1 },
      { path: '/admin/', url: '', status: 403, kind: 'directory', depth: 1 },
    ]);
    expect(findings.map((f) => [f.id, f.status])).toEqual([
      ['dir-buster.listing:/files/', 'warn'],
      ['dir-buster.backup:/site.zip', 'warn'],
      ['dir-buster.path:/admin/', 'info'],
    ]);
  });
});

describe('withDirectoryResponse', () => {
  const hit = {
    path: '/uploads/',
    url: 'https://x.test/uploads/',
    status: 301,
    kind: 'directory' as const,
    depth: 1,
  };

  it('takes over what the directory answers', () => {
    expect(
      withDirectoryResponse(hit, {
        status: 200,
        body: '<title>Index of /uploads/</title>',
        length: 40,
        contentType: 'text/html',
      }),
    ).toEqual({
      ...hit,
      status: 200,
      length: 40,
      contentType: 'text/html',
      title: 'Index of /uploads/',
      listing: true,
    });
    expect(withDirectoryResponse(hit, { status: 403 })).toMatchObject({
      status: 403,
    });
  });

  it('keeps the redirect when the directory itself is not found', () => {
    expect(withDirectoryResponse(hit, { status: 404 })).toEqual(hit);
  });
});
