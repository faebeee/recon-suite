import { ForbiddenException } from '@nestjs/common';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { followRedirects } from '../../core/http/follow-redirects.js';
import type { TargetGuardService } from '../../core/net/target-guard.service.js';
import { WebFilesService } from './web-files.service.js';

const guard = (blocked = false) =>
  ({
    resolve: vi.fn(async (host: string) => {
      if (blocked) throw new ForbiddenException('blocked');
      return { host, addresses: ['93.184.216.34'] };
    }),
  }) as unknown as TargetGuardService;

const fakeHttp = (files: Record<string, Response>) => {
  const send = vi.fn(
    async (url: string) => files[url] ?? new Response('nope', { status: 404 }),
  );
  return {
    send,
    http: {
      targetFollow: (url: string) => followRedirects(send, url),
    } as unknown as HttpClientService,
  };
};

describe('WebFilesService', () => {
  it('collects files, falls back to the legacy security.txt and flags soft 404s', async () => {
    const { http } = fakeHttp({
      'https://x.test/robots.txt': new Response(
        'User-agent: *\nDisallow: /admin\nSitemap: https://x.test/sm.xml',
        { headers: { 'content-type': 'text/plain' } },
      ),
      'https://x.test/sm.xml': new Response(
        '<urlset><url><loc>https://x.test/</loc></url></urlset>',
        {
          headers: { 'content-type': 'application/xml' },
        },
      ),
      'https://x.test/security.txt': new Response('Contact: mailto:a@x.test', {
        headers: { 'content-type': 'text/plain' },
      }),
      'https://x.test/humans.txt': new Response(
        '<!doctype html><html></html>',
        {
          headers: { 'content-type': 'text/html' },
        },
      ),
    });
    const out = await new WebFilesService(http, guard()).fetch({
      target: 'https://x.test/some/page',
    });
    expect(out.origin).toBe('https://x.test');
    expect(out.robots?.interesting).toEqual(['/admin']);
    expect(out.sitemap).toMatchObject({
      url: 'https://x.test/sm.xml',
      count: 1,
    });
    expect(out.securityTxt?.fields).toEqual([
      { name: 'Contact', value: 'mailto:a@x.test' },
    ]);
    expect(out.files.find((f) => f.file === 'humans.txt')).toMatchObject({
      found: false,
      soft404: true,
    });
    expect(out.humans).toBeUndefined();
  });

  it('rejects blocked targets before any request', async () => {
    const { http, send } = fakeHttp({});
    await expect(
      new WebFilesService(http, guard(true)).fetch({
        target: 'http://127.0.0.1/',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(send).not.toHaveBeenCalled();
  });

  it('records per-file errors without failing the whole run', async () => {
    const send = vi.fn(async () => {
      throw new Error('connection reset');
    });
    const http = {
      targetFollow: (url: string) => followRedirects(send, url),
    } as unknown as HttpClientService;
    const out = await new WebFilesService(http, guard()).fetch({
      target: 'https://x.test',
    });
    expect(out.files.every((f) => f.error === 'connection reset')).toBe(true);
  });
});
