import { NotFoundException } from '@nestjs/common';
import { EXPOSED_FILE_CHECKS } from '@recon/shared';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import type { TargetGuardService } from '../../core/net/target-guard.service.js';
import { ExposedFilesService } from './exposed-files.service.js';

const guard = (blocked = false) =>
  ({
    resolve: vi.fn(async (host: string) => {
      if (blocked) throw new NotFoundException('unresolvable');
      return { host, addresses: ['93.184.216.34'] };
    }),
  }) as unknown as TargetGuardService;

const fakeHttp = (handler: (url: string) => Response) => {
  const target = vi.fn(async (url: string, _opts?: unknown) => handler(url));
  return { target, http: { target } as unknown as HttpClientService };
};

describe('ExposedFilesService', () => {
  it('checks every path on the origin and separates exposed, soft-404 and errors', async () => {
    const { http, target } = fakeHttp((url) => {
      if (url.endsWith('/.git/HEAD'))
        return new Response('ref: refs/heads/main\n');
      if (url.endsWith('/.env'))
        return new Response('<html><body>home</body></html>');
      if (url.endsWith('/web.config')) throw new Error('connection reset');
      if (url.endsWith('/server-status'))
        return new Response(null, { status: 302, headers: { location: '/' } });
      return new Response('nope', { status: 404 });
    });
    const out = await new ExposedFilesService(http, guard()).check({
      target: 'https://x.test/some/page?q=1',
    });
    expect(out.origin).toBe('https://x.test');
    expect(out.checks).toHaveLength(EXPOSED_FILE_CHECKS.length);
    expect(target).toHaveBeenCalledWith('https://x.test/.git/HEAD', {
      redirect: 'manual',
      timeoutMs: 8000,
    });
    const by = Object.fromEntries(out.checks.map((c) => [c.path, c]));
    expect(by['/.git/HEAD']).toMatchObject({ exposed: true, status: 200 });
    expect(by['/.env']).toMatchObject({ exposed: false, soft404: true });
    expect(by['/web.config']).toMatchObject({
      exposed: false,
      error: 'connection reset',
    });
    expect(by['/server-status']).toMatchObject({ exposed: false, status: 302 });
    expect(out.findings).toEqual([
      expect.objectContaining({ id: 'exposed-files.git-head', status: 'fail' }),
    ]);
  });

  it('stops before any request when the target does not resolve', async () => {
    const { http, target } = fakeHttp(() => new Response(''));
    await expect(
      new ExposedFilesService(http, guard(true)).check({
        target: 'http://127.0.0.1/',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(target).not.toHaveBeenCalled();
  });
});
