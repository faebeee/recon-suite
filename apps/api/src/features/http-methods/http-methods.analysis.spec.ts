import type { HttpMethodsOutput } from '@recon/shared';
import {
  detectDefaultPage,
  findLeaks,
  isHttpsRedirect,
  methodsFindings,
  parseAllow,
  parseHsts,
  preloadCandidates,
  riskyMethods,
} from './http-methods.analysis.js';

describe('parseAllow', () => {
  it('uses Allow first, falls back, normalises and dedupes', () => {
    expect(parseAllow('get, HEAD,OPTIONS, get', 'PUT')).toEqual([
      'GET',
      'HEAD',
      'OPTIONS',
    ]);
    expect(parseAllow(null, 'GET, PUT')).toEqual(['GET', 'PUT']);
    expect(parseAllow(undefined, '  ')).toEqual([]);
  });

  it('flags risky methods', () => {
    expect(riskyMethods(['GET', 'PUT', 'PROPFIND', 'HEAD'])).toEqual([
      'PUT',
      'PROPFIND',
    ]);
  });
});

describe('parseHsts', () => {
  it('reads directives case-insensitively', () => {
    expect(
      parseHsts('max-age="63072000"; IncludeSubDomains; preload'),
    ).toMatchObject({
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    });
    expect(parseHsts(null)).toEqual({
      includeSubDomains: false,
      preload: false,
    });
  });
});

describe('isHttpsRedirect', () => {
  it('needs a 3xx to an https URL', () => {
    expect(isHttpsRedirect(301, 'https://x.test/', 'http://x.test/')).toBe(
      true,
    );
    expect(isHttpsRedirect(302, '/login', 'http://x.test/')).toBe(false);
    expect(isHttpsRedirect(200, 'https://x.test/', 'http://x.test/')).toBe(
      false,
    );
  });
});

describe('preloadCandidates', () => {
  it('walks up to two labels, at most three names, never for IPs', () => {
    expect(preloadCandidates('a.b.example.com')).toEqual([
      'a.b.example.com',
      'b.example.com',
      'example.com',
    ]);
    expect(preloadCandidates('example.com')).toEqual(['example.com']);
    expect(preloadCandidates('192.0.2.1')).toEqual([]);
    expect(preloadCandidates('[::1]')).toEqual([]);
  });
});

describe('findLeaks', () => {
  it('finds banners, stack traces and disclosing headers', () => {
    const leaks = findLeaks(
      '<hr><address>Apache/2.4.41 (Ubuntu) Server</address> Traceback (most recent call last):',
      { server: 'nginx/1.18.0', 'x-powered-by': 'PHP/7.4.3' },
    );
    expect(leaks).toEqual([
      'Python traceback',
      'Version in page: Apache/2.4.41',
      'Server: nginx/1.18.0',
      'x-powered-by: PHP/7.4.3',
    ]);
  });

  it('ignores a plain 404 and versionless Server headers', () => {
    expect(findLeaks('<h1>Not Found</h1>', { server: 'cloudflare' })).toEqual(
      [],
    );
  });
});

describe('detectDefaultPage', () => {
  it('recognises install pages', () => {
    expect(
      detectDefaultPage('<html><title>Welcome to nginx!</title></html>'),
    ).toBe('nginx welcome page');
    expect(detectDefaultPage('<h1>My shop</h1>')).toBeUndefined();
  });
});

const base: Omit<HttpMethodsOutput, 'findings'> = {
  url: 'https://x.test/',
  status: 200,
  options: { status: 204, allowed: ['GET', 'HEAD'], risky: [] },
  trace: { status: 405, reflected: false },
  httpsRedirect: {
    url: 'http://x.test/',
    status: 301,
    location: 'https://x.test/',
    redirectsToHttps: true,
  },
  hsts: {
    header: 'max-age=63072000; includeSubDomains; preload',
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
    preloadList: { domain: 'x.test', status: 'preloaded' },
  },
  errorPage: {
    url: 'https://x.test/nope',
    status: 404,
    leaks: [],
    soft404: false,
  },
};
const statuses = (o: Omit<HttpMethodsOutput, 'findings'>) =>
  Object.fromEntries(methodsFindings(o).map((f) => [f.id, f.status]));

describe('methodsFindings', () => {
  it('passes a hardened site', () => {
    expect(statuses(base)).toEqual({
      'methods.allowed': 'pass',
      'methods.trace': 'pass',
      'https.redirect': 'pass',
      'hsts.header': 'pass',
      'hsts.preload-ready': 'pass',
      'hsts.preload-list': 'pass',
      'errors.leaks': 'pass',
    });
  });

  it('flags a misconfigured one', () => {
    const s = statuses({
      ...base,
      options: {
        status: 200,
        allowed: ['GET', 'PUT', 'TRACE'],
        risky: ['PUT', 'TRACE'],
      },
      trace: { status: 200, reflected: true },
      httpsRedirect: {
        url: 'http://x.test/',
        status: 200,
        redirectsToHttps: false,
      },
      hsts: { includeSubDomains: false, preload: false },
      errorPage: {
        ...base.errorPage,
        status: 200,
        leaks: ['Server: nginx/1.18.0'],
        soft404: true,
      },
      defaultPage: 'nginx welcome page',
    });
    expect(s).toEqual({
      'methods.allowed': 'warn',
      'methods.trace': 'fail',
      'https.redirect': 'fail',
      'hsts.header': 'fail',
      'errors.leaks': 'warn',
      'errors.soft404': 'info',
      'default.page': 'warn',
    });
  });

  it('treats an unreachable port 80 as informational', () => {
    const s = statuses({
      ...base,
      httpsRedirect: {
        url: 'http://x.test/',
        redirectsToHttps: false,
        error: 'connection refused',
      },
    });
    expect(s['https.redirect']).toBe('info');
  });
});
