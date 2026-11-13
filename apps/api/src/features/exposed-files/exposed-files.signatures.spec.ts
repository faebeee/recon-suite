import type { ExposedFileCheck } from '@recon/shared';
import {
  exposedFindings,
  maskSecrets,
  matchSignature,
  sanitiseEvidence,
} from './exposed-files.signatures.js';

const HTML = '<!DOCTYPE html><html><body>Not found</body></html>';

describe('matchSignature', () => {
  it.each([
    ['/.git/HEAD', 'ref: refs/heads/main\n'],
    ['/.git/HEAD', `${'a'.repeat(40)}\n`],
    ['/.git/config', '[core]\n\trepositoryformatversion = 0\n'],
    ['/.svn/entries', '12\n'],
    ['/.svn/entries', '<?xml version="1.0"?><wc-entries xmlns="svn:">'],
    ['/.hg/requires', 'dotencode\nfncache\nrevlogv1\nstore\n'],
    ['/.env', 'APP_ENV=prod\nDB_PASSWORD=hunter2\n'],
    ['/.DS_Store', '\0\0\0\u0001Bud1\0\0\u0010\0'],
    [
      '/server-status',
      '<html><title>Apache Status</title><h1>Apache Server Status for x</h1>',
    ],
    ['/server-info', '<h1>Apache Server Information</h1>'],
    [
      '/phpinfo.php',
      '<html><body><h1 class="p">PHP Version 8.2.1</h1></body></html>',
    ],
    [
      '/actuator',
      '{"_links":{"self":{"href":"/actuator"},"env":{"href":"/actuator/env"}}}',
    ],
    [
      '/actuator/env',
      '{"activeProfiles":["prod"],"propertySources":[{"name":"a"}]}',
    ],
    ['/.well-known/openid-configuration', '{"issuer":"https://id.x.test"}'],
    [
      '/swagger.json',
      '{"swagger":"2.0","info":{"title":"API"},"paths":{"/a":{}}}',
    ],
    ['/openapi.json', '{"openapi":"3.1.0","paths":{}}'],
    [
      '/crossdomain.xml',
      '<cross-domain-policy><allow-access-from domain="*"/></cross-domain-policy>',
    ],
    ['/.htaccess', '# x\nRewriteEngine On\nRewriteRule ^ index.php [L]\n'],
    [
      '/web.config',
      '<?xml version="1.0"?><configuration><system.webServer/></configuration>',
    ],
    ['/wp-config.php.bak', "<?php define('DB_PASSWORD', 'secret123');"],
  ])('detects %s', (path, body) => {
    const m = matchSignature(path, body);
    expect(m.exposed).toBe(true);
    expect(m.evidence?.length).toBeLessThanOrEqual(200);
  });

  it.each([
    '/.git/HEAD',
    '/.git/config',
    '/.svn/entries',
    '/.hg/requires',
    '/.env',
    '/.DS_Store',
    '/server-status',
    '/phpinfo.php',
    '/actuator',
    '/actuator/env',
    '/swagger.json',
    '/.htaccess',
    '/web.config',
    '/crossdomain.xml',
  ])('rejects an HTML soft-404 page for %s', (path) => {
    expect(matchSignature(path, HTML).exposed).toBe(false);
  });

  it('rejects .env-like text inside HTML and single lines', () => {
    expect(matchSignature('/.env', `${HTML}\nA=1\nB=2`).exposed).toBe(false);
    expect(matchSignature('/.env', 'A=1').exposed).toBe(false);
  });

  it('never leaks .env values', () => {
    const m = matchSignature(
      '/.env',
      'APP_KEY=base64:abc\nexport DB_PASSWORD="hunter2"\n',
    );
    expect(m.evidence).toBe('APP_KEY=**** DB_PASSWORD=****');
  });

  it('masks credentials in config files', () => {
    const git = matchSignature(
      '/.git/config',
      '[core]\n[remote "origin"]\n\turl = https://bob:s3cr3t@git.x.test/repo.git\n',
    );
    expect(git.evidence).toContain('https://****@git.x.test');
    expect(git.evidence).not.toContain('s3cr3t');

    const wp = matchSignature(
      '/wp-config.php.bak',
      "define('DB_PASSWORD', 'secret123');",
    );
    expect(wp.evidence).not.toContain('secret123');

    const web = matchSignature(
      '/web.config',
      '<configuration><add name="db" connectionString="Server=x;Password=pw1" /><add key="ApiKey" value="v" password="pw2"/></configuration>',
    );
    expect(web.evidence).not.toMatch(/pw1|pw2/);
  });
});

describe('maskSecrets', () => {
  it('masks JSON, key=value and URL credentials', () => {
    expect(maskSecrets('{"client_secret":"abc"}')).toBe(
      '{"client_secret":"****"}',
    );
    expect(maskSecrets('api_key: abc123 other')).toBe('api_key: **** other');
    expect(maskSecrets('ftp://u:p@h')).toBe('ftp://****@h');
  });
});

describe('sanitiseEvidence', () => {
  it('removes control chars and caps the length', () => {
    expect(sanitiseEvidence('a\0\nb\t c')).toBe('a b c');
    expect(sanitiseEvidence('x'.repeat(500))).toHaveLength(200);
  });
});

describe('exposedFindings', () => {
  const check = (over: Partial<ExposedFileCheck>): ExposedFileCheck => ({
    path: '/.env',
    title: 'Environment file',
    severity: 'high',
    url: 'https://x.test/.env',
    exposed: false,
    ...over,
  });

  it('passes when nothing is exposed', () => {
    expect(exposedFindings([check({})])).toEqual([
      expect.objectContaining({ status: 'pass' }),
    ]);
  });

  it('maps severity to status', () => {
    const f = exposedFindings([
      check({ exposed: true }),
      check({ path: '/.DS_Store', severity: 'medium', exposed: true }),
      check({ path: '/swagger.json', severity: 'low', exposed: true }),
      check({
        path: '/.well-known/openid-configuration',
        severity: 'info',
        exposed: true,
      }),
    ]);
    expect(f.map((x) => [x.id, x.status])).toEqual([
      ['exposed-files.env', 'fail'],
      ['exposed-files.ds-store', 'fail'],
      ['exposed-files.swagger-json', 'warn'],
      ['exposed-files.well-known-openid-configuration', 'info'],
    ]);
  });
});
