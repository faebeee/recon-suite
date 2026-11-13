import type { JsScript } from '@recon/shared';
import {
  analyseSource,
  classifyLiteral,
  extractEndpoints,
  extractPageScripts,
  extractSecrets,
  findSourceMap,
  isSameSite,
  jsFindings,
  maskSecret,
  mergeResults,
} from './js-endpoints.parser.js';

describe('extractPageScripts', () => {
  it('collects script srcs, module preloads and inline JS', () => {
    const html = `
      <script src="/static/app.js"></script>
      <script src='https://cdn.other.test/lib.js' async></script>
      <script src=rel/chunk.js defer></script>
      <script src="/static/app.js"></script>
      <script src="javascript:alert(1)"></script>
      <link rel="modulepreload" href="/assets/m.js">
      <link rel="stylesheet" href="/a.css">
      <script>fetch('/api/inline')</script>
      <script type="application/ld+json">{"a":"/not-js"}</script>
      <script type="module">import x from "/x.js"</script>`;
    const r = extractPageScripts(html, 'https://www.x.test/dir/page');
    expect(r.urls).toEqual([
      'https://www.x.test/static/app.js',
      'https://cdn.other.test/lib.js',
      'https://www.x.test/dir/rel/chunk.js',
      'https://www.x.test/assets/m.js',
    ]);
    expect(r.inline).toEqual(["fetch('/api/inline')", 'import x from "/x.js"']);
  });
});

describe('isSameSite', () => {
  it('accepts the host and subdomains of the www-stripped host', () => {
    expect(isSameSite('https://www.x.test/a.js', 'www.x.test')).toBe(true);
    expect(isSameSite('https://x.test/a.js', 'www.x.test')).toBe(true);
    expect(isSameSite('https://static.x.test/a.js', 'www.x.test')).toBe(true);
    expect(isSameSite('https://evilx.test/a.js', 'x.test')).toBe(false);
    expect(isSameSite('https://cdn.test/a.js', 'x.test')).toBe(false);
  });
});

describe('classifyLiteral / extractEndpoints', () => {
  it.each([
    ['/api/v1/users', 'path'],
    ['/graphql?x=1', 'path'],
    ['https://api.x.test/v2/', 'url'],
  ])('accepts %s', (v, kind) => {
    expect(classifyLiteral(v)).toEqual({ value: v, kind });
  });

  it.each([
    '/',
    '/1',
    '/a b',
    '//cdn.x.test/a',
    '/img/logo.png',
    '/fonts/a.woff2?v=1',
    '/style.css',
    `/${'a'.repeat(250)}`,
    'https://localhostish',
    'text/html',
  ])('rejects %s', (v) => {
    expect(classifyLiteral(v)).toBeUndefined();
  });

  it('extracts from all literal kinds, skips interpolated templates and dedupes', () => {
    const code = [
      `fetch("/api/users");`,
      `axios.get('/api/users');`,
      'const u = `https://api.x.test/v1`;',
      'const t = `/api/${id}`;',
      `const e = "https:\\/\\/esc.x.test\\/p";`,
      `const n = "not an endpoint";`,
    ].join('\n');
    expect(extractEndpoints(code)).toEqual([
      { value: '/api/users', kind: 'path' },
      { value: 'https://api.x.test/v1', kind: 'url' },
      { value: 'https://esc.x.test/p', kind: 'url' },
    ]);
  });
});

describe('extractSecrets', () => {
  it('finds and masks known secret patterns and dedupes them', () => {
    const aws = 'AKIAABCDEFGHIJKLMNOP';
    const google = `AIza${'a'.repeat(35)}`;
    const gh = `ghp_${'A'.repeat(36)}`;
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig_part';
    const code = `a="${aws}";b="${aws}";c="${google}";d="${gh}";e="${jwt}";
      f="sk_live_${'x'.repeat(24)}";g="xoxb-1234567890-abc";
      -----BEGIN RSA PRIVATE KEY-----`;
    const s = extractSecrets(code, 'https://x.test/a.js');
    expect(s.map((x) => x.type)).toEqual([
      'AWS access key',
      'Google API key',
      'Stripe live secret key',
      'Slack token',
      'GitHub token',
      'JWT',
      'private key',
    ]);
    expect(s[0]).toEqual({
      type: 'AWS access key',
      masked: 'AKIA…MNOP',
      source: 'https://x.test/a.js',
    });
    expect(
      s.every((x) => !code.includes(x.masked) || x.masked.length < 12),
    ).toBe(true);
  });

  it('masks short values completely', () => {
    expect(maskSecret('abcdefgh')).toBe('****');
    expect(maskSecret('abcdefghij')).toBe('abcd…ghij');
  });
});

describe('findSourceMap', () => {
  it('resolves the last sourceMappingURL and skips data URLs', () => {
    expect(
      findSourceMap(
        'x\n//# sourceMappingURL=app.js.map\n',
        'https://x.test/js/app.js',
      ),
    ).toBe('https://x.test/js/app.js.map');
    expect(
      findSourceMap(
        '/*# sourceMappingURL=/m/a.map */',
        'https://x.test/js/a.js',
      ),
    ).toBe('https://x.test/m/a.map');
    expect(
      findSourceMap(
        '//# sourceMappingURL=data:application/json;base64,e30=',
        'https://x.test/a.js',
      ),
    ).toBeUndefined();
    expect(findSourceMap('nothing', 'https://x.test/a.js')).toBeUndefined();
  });
});

describe('mergeResults / jsFindings', () => {
  it('dedupes endpoints across sources (max 3 sources) and collects hosts', () => {
    const sources = ['a', 'b', 'c', 'd'].map((s) =>
      analyseSource('fetch("/api/x"); u="https://B.x.test/p"', s),
    );
    const m = mergeResults(sources);
    expect(m.endpoints).toEqual([
      { value: '/api/x', kind: 'path', sources: ['a', 'b', 'c'] },
      { value: 'https://B.x.test/p', kind: 'url', sources: ['a', 'b', 'c'] },
    ]);
    expect(m.hosts).toEqual(['b.x.test']);
  });

  it('reports secrets by severity, exposed maps and endpoint count', () => {
    const scripts: JsScript[] = [
      {
        url: 'https://x.test/a.js',
        external: false,
        bytes: 10,
        sourceMap: 'https://x.test/a.js.map',
        sourceMapExposed: true,
      },
    ];
    const f = jsFindings(
      scripts,
      [{ value: '/api', kind: 'path', sources: ['a'] }],
      [
        { type: 'AWS access key', masked: 'AKIA…MNOP', source: 'a' },
        { type: 'JWT', masked: 'eyJh…part', source: 'a' },
      ],
    );
    expect(f.map((x) => [x.id, x.status])).toEqual([
      ['js.secret.aws-access-key', 'fail'],
      ['js.secret.jwt', 'warn'],
      ['js.sourcemaps', 'warn'],
      ['js.endpoints', 'info'],
    ]);
    expect(jsFindings([], [], []).map((x) => x.status)).toEqual([
      'pass',
      'info',
    ]);
  });
});
