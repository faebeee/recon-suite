import { NotFoundException } from '@nestjs/common';
import { MAX_DIR_BUSTER_REQUESTS, dirBusterInputSchema } from '@recon/shared';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import type { TargetGuardService } from '../../core/net/target-guard.service.js';
import { DirBusterService } from './dir-buster.service.js';

const guard = (blocked = false) =>
  ({
    resolve: vi.fn(async (host: string) => {
      if (blocked) throw new NotFoundException('unresolvable');
      return { host, addresses: ['93.184.216.34'] };
    }),
  }) as unknown as TargetGuardService;

const fakeHttp = (handler: (url: URL) => Response | Promise<Response>) => {
  const target = vi.fn(async (url: string, _opts?: unknown) =>
    handler(new URL(url)),
  );
  return { target, http: { target } as unknown as HttpClientService };
};

const notFound = () => new Response('not found', { status: 404 });
const params = (input: Record<string, unknown>) =>
  dirBusterInputSchema.parse({ target: 'https://x.test', ...input });

function service(http: HttpClientService, now = () => 0) {
  return new DirBusterService(http, guard()).useClock({
    now,
    token: () => 'rsRANDOM',
  });
}

describe('DirBusterService', () => {
  it('finds files and directories and recurses into directories', async () => {
    const { http, target } = fakeHttp((url) => {
      switch (url.pathname) {
        case '/admin':
          return new Response(null, {
            status: 301,
            headers: { location: '/admin/' },
          });
        case '/admin/login':
          return new Response('<title>Admin login</title>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        case '/backup.zip':
          return new Response('PK...', { status: 200 });
        case '/private':
          return new Response('forbidden', { status: 403 });
        default:
          return notFound();
      }
    });
    const out = await service(http).scan(
      params({
        wordlist: 'quick',
        extraWords: ['private'],
        extensions: ['zip'],
        depth: 2,
      }),
    );
    expect(target).toHaveBeenCalledWith('https://x.test/admin', {
      redirect: 'manual',
      timeoutMs: 8000,
    });
    expect(out.hits.map((h) => [h.path, h.status, h.kind, h.depth])).toEqual([
      ['/admin/', 301, 'directory', 1],
      ['/admin/login', 200, 'file', 2],
      ['/backup.zip', 200, 'file', 1],
      ['/private', 403, 'file', 1],
    ]);
    expect(out.hits.find((h) => h.path === '/admin/login')).toMatchObject({
      title: 'Admin login',
      contentType: 'text/html',
    });
    expect(out.wildcardDirs).toEqual([]);
    expect(out.stopped).toBeUndefined();
    expect(out.findings).toContainEqual(
      expect.objectContaining({
        id: 'dir-buster.backup:/backup.zip',
        status: 'warn',
      }),
    );
    // Calibration (bare + .zip) for / and /admin/, every candidate in both, and one
    // follow-up request to /admin/ itself (404 here, so the redirect is kept).
    const perDir = 2 + out.words * 2;
    expect(out.requests).toBe(perDir * 2 + 1);
  });

  it('filters catch-all routes by comparing with a random path', async () => {
    const spa = '<html><title>App</title><div id="root"></div></html>';
    const { http } = fakeHttp((url) =>
      url.pathname === '/api'
        ? new Response('{"ok":true,"version":"1.2.3","routes":[]}'.repeat(5), {
            headers: { 'content-type': 'application/json' },
          })
        : new Response(spa, { headers: { 'content-type': 'text/html' } }),
    );
    const out = await service(http).scan(params({}));
    expect(out.wildcardDirs).toEqual(['/']);
    expect(out.hits.map((h) => h.path)).toEqual(['/api']);
  });

  it('stops at the time budget and keeps what it found', async () => {
    let t = 0;
    const { http } = fakeHttp((url) => {
      t += 1000; // every request "takes" a second
      return url.pathname === '/admin'
        ? new Response('admin', { status: 200 })
        : notFound();
    });
    const out = await service(http, () => t).scan(
      params({ wordlist: 'common' }),
    );
    expect(out.stopped).toBe('time-limit');
    expect(out.requests).toBe(180);
    expect(out.hits.map((h) => h.path)).toEqual(['/admin']);
  });

  it('caps the number of requests', async () => {
    const { http } = fakeHttp(() => notFound());
    const out = await service(http).scan(
      params({
        wordlist: 'common',
        extensions: ['php', 'html', 'txt', 'bak', 'zip'],
        extraWords: Array.from({ length: 200 }, (_, i) => `w${i}`),
      }),
    );
    expect(out.stopped).toBe('request-limit');
    expect(out.requests).toBe(MAX_DIR_BUSTER_REQUESTS);
  });

  it('stops when the server rate-limits', async () => {
    const { http } = fakeHttp(() => new Response('slow down', { status: 429 }));
    const out = await service(http).scan(params({ threads: 1 }));
    expect(out.stopped).toBe('rate-limited');
    expect(out.requests).toBe(10);
  });

  it('counts failed requests as errors instead of failing the scan', async () => {
    const { http } = fakeHttp((url) => {
      if (url.pathname === '/admin') throw new Error('connection reset');
      return notFound();
    });
    const out = await service(http).scan(params({}));
    expect(out.errors).toBe(1);
    expect(out.hits).toEqual([]);
  });

  it('stops before any request when the target does not resolve', async () => {
    const { http, target } = fakeHttp(() => notFound());
    await expect(
      new DirBusterService(http, guard(true)).scan(params({})),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(target).not.toHaveBeenCalled();
  });

  it('rejects words that are not a single path segment', () => {
    for (const word of ['../etc', 'a/b', '..', 'a?b=1', 'x'.repeat(65)]) {
      expect(
        dirBusterInputSchema.safeParse({
          target: 'https://x.test',
          extraWords: [word],
        }).success,
      ).toBe(false);
    }
  });
});
