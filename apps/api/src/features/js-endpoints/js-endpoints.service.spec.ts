import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { followRedirects } from '../../core/http/follow-redirects.js';
import { JsEndpointsService } from './js-endpoints.service.js';

const PAGE = `<html><head>
  <script src="/js/app.js"></script>
  <script src="https://static.x.test/js/vendor.js"></script>
  <script src="https://cdn.other.test/lib.js"></script>
  <script src="/js/extra.js"></script>
  <script>window.cfg = { api: "https://api.x.test/v1" }</script>
</head></html>`;

const fakeHttp = () => {
  const target = vi.fn(
    async (url: string, opts: { method?: string } = {}): Promise<Response> => {
      switch (url) {
        case 'https://x.test/':
          return new Response(null, {
            status: 301,
            headers: { location: 'https://www.x.test/' },
          });
        case 'https://www.x.test/':
          return new Response(PAGE, {
            headers: { 'content-type': 'text/html' },
          });
        case 'https://www.x.test/js/app.js':
          return new Response(
            'fetch("/api/login");const k="AKIAABCDEFGHIJKLMNOP";\n//# sourceMappingURL=app.js.map',
          );
        case 'https://www.x.test/js/app.js.map':
          return opts.method === 'HEAD'
            ? new Response(null, { status: 405 })
            : new Response('{}');
        case 'https://static.x.test/js/vendor.js':
          throw new Error('connection reset');
        default:
          return new Response('nope', { status: 404 });
      }
    },
  );
  const http = {
    target,
    targetFollow: (url: string) => followRedirects((u) => target(u), url),
  } as unknown as HttpClientService;
  return { http, target };
};

describe('JsEndpointsService', () => {
  it('downloads same-site scripts only, within the limit, and aggregates results', async () => {
    const { http, target } = fakeHttp();
    const out = await new JsEndpointsService(http).analyse({
      target: 'https://x.test/',
      maxScripts: 2,
    });
    expect(out.page).toBe('https://www.x.test/');
    expect(out.scripts).toEqual([
      expect.objectContaining({
        url: 'https://www.x.test/js/app.js',
        external: false,
        status: 200,
        sourceMap: 'https://www.x.test/js/app.js.map',
        sourceMapExposed: true,
      }),
      expect.objectContaining({
        url: 'https://static.x.test/js/vendor.js',
        external: false,
        error: 'connection reset',
      }),
      { url: 'https://cdn.other.test/lib.js', external: true },
      expect.objectContaining({
        url: 'https://www.x.test/js/extra.js',
        error: expect.stringMatching(/limit/),
      }),
    ]);
    const fetched = target.mock.calls.map((c) => c[0]);
    expect(fetched).not.toContain('https://cdn.other.test/lib.js');
    expect(fetched).not.toContain('https://www.x.test/js/extra.js');

    expect(out.endpoints.map((e) => e.value).sort()).toEqual([
      '/api/login',
      'https://api.x.test/v1',
    ]);
    expect(out.hosts).toEqual(['api.x.test']);
    expect(out.secrets).toEqual([
      {
        type: 'AWS access key',
        masked: 'AKIA…MNOP',
        source: 'https://www.x.test/js/app.js',
      },
    ]);
    expect(out.findings.map((f) => f.id)).toEqual([
      'js.secret.aws-access-key',
      'js.sourcemaps',
      'js.endpoints',
    ]);
  });
});
