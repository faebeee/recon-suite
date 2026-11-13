import {
  isSoft404,
  parseRobots,
  parseSecurityTxt,
  parseSitemap,
} from './web-files.parser.js';

describe('parseRobots', () => {
  it('groups consecutive user-agents and flags interesting paths', () => {
    const r = parseRobots(
      [
        '# comment',
        'User-agent: Googlebot',
        'User-agent: Bingbot',
        'Disallow: /search',
        '',
        'User-agent: *',
        'Disallow: /admin/ # hidden',
        'Disallow: /backup.zip',
        'Allow: /public',
        'Disallow:',
        'Crawl-delay: 5',
        'Sitemap: https://x.test/sitemap_index.xml',
      ].join('\n'),
    );
    expect(r.groups).toEqual([
      {
        userAgents: ['Googlebot', 'Bingbot'],
        allow: [],
        disallow: ['/search'],
      },
      {
        userAgents: ['*'],
        allow: ['/public'],
        disallow: ['/admin/', '/backup.zip'],
        crawlDelay: '5',
      },
    ]);
    expect(r.sitemaps).toEqual(['https://x.test/sitemap_index.xml']);
    expect(r.interesting).toEqual(['/admin/', '/backup.zip']);
  });
});

describe('parseSitemap', () => {
  it('counts locs and samples them', () => {
    const s = parseSitemap(
      'https://x.test/sitemap.xml',
      '<urlset><url><loc>https://x.test/a?x=1&amp;y=2</loc></url><url><loc><![CDATA[https://x.test/b]]></loc></url></urlset>',
    );
    expect(s).toEqual({
      url: 'https://x.test/sitemap.xml',
      kind: 'urlset',
      count: 2,
      sample: ['https://x.test/a?x=1&y=2', 'https://x.test/b'],
    });
  });

  it('recognises sitemap indexes', () => {
    expect(
      parseSitemap(
        'u',
        '<sitemapindex><sitemap><loc>https://x.test/s1.xml</loc></sitemap></sitemapindex>',
      ).kind,
    ).toBe('sitemapindex');
  });
});

describe('isSoft404', () => {
  it('detects HTML served for a text file', () => {
    expect(isSoft404('text/html; charset=utf-8', 'whatever')).toBe(true);
    expect(isSoft404('text/plain', '<!DOCTYPE html><html>')).toBe(true);
    expect(isSoft404('text/plain', 'User-agent: *')).toBe(false);
  });
});

describe('parseSecurityTxt', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const url = 'https://x.test/.well-known/security.txt';
  const status = (text: string, id: string, u = url) =>
    parseSecurityTxt(text, u, now).findings.find((f) => f.id === id)?.status;

  it('passes a valid file', () => {
    const text = 'Contact: mailto:sec@x.test\nExpires: 2026-06-01T00:00:00Z\n';
    const r = parseSecurityTxt(text, url, now);
    expect(r.fields).toHaveLength(2);
    expect(r.findings.filter((f) => f.status === 'fail')).toEqual([]);
  });

  it('fails missing contact and expired files', () => {
    expect(status('Expires: 2025-01-01T00:00:00Z', 'securitytxt.contact')).toBe(
      'fail',
    );
    expect(status('Expires: 2025-01-01T00:00:00Z', 'securitytxt.expires')).toBe(
      'fail',
    );
    expect(status('Contact: x', 'securitytxt.expires')).toBe('fail');
  });

  it('warns for the legacy location and long expiry', () => {
    const text = 'Contact: x\nExpires: 2030-01-01T00:00:00Z';
    expect(status(text, 'securitytxt.expires')).toBe('warn');
    expect(
      status(text, 'securitytxt.location', 'https://x.test/security.txt'),
    ).toBe('warn');
  });

  it('reads fields inside a PGP signed message', () => {
    const text = [
      '-----BEGIN PGP SIGNED MESSAGE-----',
      'Hash: SHA256',
      '',
      'Contact: mailto:a@x.test',
      'Expires: 2026-06-01T00:00:00Z',
      '-----BEGIN PGP SIGNATURE-----',
      'abc',
      '-----END PGP SIGNATURE-----',
    ].join('\n');
    const r = parseSecurityTxt(text, url, now);
    expect(r.signed).toBe(true);
    expect(r.fields.map((f) => f.name)).toEqual(['Contact', 'Expires']);
  });
});
