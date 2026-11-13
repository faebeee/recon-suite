import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { followRedirects } from '../../core/http/follow-redirects.js';
import { CorsService } from './cors.service.js';

interface Req {
  url: string;
  method?: string;
  headers?: Record<string, string>;
}

/** Fake server that reflects any Origin with credentials, like a classic misconfiguration. */
const fakeHttp = () => {
  const calls: Req[] = [];
  const target = vi.fn(
    async (url: string, opts: Omit<Req, 'url'> = {}): Promise<Response> => {
      calls.push({ url, ...opts });
      if (url === 'https://x.test/') {
        return new Response(null, {
          status: 301,
          headers: { location: 'https://www.x.test/' },
        });
      }
      const origin = opts.headers?.origin;
      if (origin === 'null') throw new Error('connection reset');
      const headers: Record<string, string> = {};
      if (origin) {
        headers['access-control-allow-origin'] = origin;
        headers['access-control-allow-credentials'] = 'true';
      }
      return new Response('', { status: 200, headers });
    },
  );
  const http = {
    target,
    targetFollow: (url: string) => followRedirects((u) => target(u), url),
  } as unknown as HttpClientService;
  return { http, calls };
};

describe('CorsService', () => {
  it('follows redirects first and probes the final URL', async () => {
    const { http, calls } = fakeHttp();
    const out = await new CorsService(http).check({
      target: 'https://x.test/',
    });
    expect(out.url).toBe('https://www.x.test/');
    const probes = calls.filter((c) => c.headers);
    expect(probes.every((c) => c.url === 'https://www.x.test/')).toBe(true);
    expect(probes.every((c) => c.method && 'redirect' in c)).toBe(true);

    const byId = Object.fromEntries(out.tests.map((t) => [t.id, t]));
    expect(byId.baseline?.verdict).toBe('pass');
    expect(byId['arbitrary-origin']?.verdict).toBe('fail');
    expect(byId['suffix-match']?.origin).toBe('https://evilwww.x.test');
    expect(byId['null-origin']?.error).toBe('connection reset');
    expect(byId['http-downgrade']?.verdict).toBe('warn');
    expect(byId.preflight?.method).toBe('OPTIONS');
    expect(out.findings.map((f) => f.id)).toContain('cors.arbitrary-origin');
  });
});
