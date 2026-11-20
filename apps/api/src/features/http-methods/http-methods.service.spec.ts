import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { followRedirects } from '../../core/http/follow-redirects.js';
import { HttpMethodsService } from './http-methods.service.js';

interface Opts {
  method?: string;
  headers?: Record<string, string>;
}

/** Plain-HTTP site with TRACE echo, WebDAV methods and a chatty 404 page. */
const fakeHttp = () => {
  const methods: string[] = [];
  const target = vi.fn(async (url: string, o: Opts = {}): Promise<Response> => {
    methods.push(o.method ?? 'GET');
    if (o.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: { allow: 'GET, HEAD, OPTIONS, PROPFIND, PUT' },
      });
    }
    if (url.includes('-not-found')) {
      return new Response('<address>Apache/2.4.41 (Ubuntu)</address>', {
        status: 404,
        headers: { server: 'Apache/2.4.41 (Ubuntu)' },
      });
    }
    return new Response('<h1>It works!</h1>', { status: 200 });
  });
  const targetRaw = vi.fn(async (_url: string, o: Opts) => ({
    status: 200,
    headers: {},
    body: `TRACE / HTTP/1.1\r\nx-recon-trace: ${o.headers?.['x-recon-trace']}\r\n`,
  }));
  const trustedJson = vi.fn();
  const http = {
    target,
    targetRaw,
    trustedJson,
    targetFollow: (url: string) => followRedirects((u) => target(u), url),
  } as unknown as HttpClientService;
  return { http, methods, trustedJson };
};

describe('HttpMethodsService', () => {
  it('runs read-only probes and reports the misconfigurations', async () => {
    const { http, methods, trustedJson } = fakeHttp();
    const out = await new HttpMethodsService(http).check({
      target: 'http://x.test/',
    });

    expect(new Set(methods)).toEqual(new Set(['GET', 'OPTIONS']));
    expect(trustedJson).not.toHaveBeenCalled(); // no HTTPS, no preload lookup
    expect(out.options.risky).toEqual(['PROPFIND', 'PUT']);
    expect(out.trace.reflected).toBe(true);
    expect(out.httpsRedirect.redirectsToHttps).toBe(false);
    expect(out.errorPage.leaks).toContain('Server: Apache/2.4.41 (Ubuntu)');
    expect(out.defaultPage).toBe('Apache "It works!" page');

    const byId = Object.fromEntries(out.findings.map((f) => [f.id, f.status]));
    expect(byId['methods.trace']).toBe('fail');
    expect(byId['https.redirect']).toBe('fail');
    expect(byId['hsts.header']).toBe('fail');
  });
});
