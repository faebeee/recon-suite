import { NotFoundException } from '@nestjs/common';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { HttpHeadersService } from './http-headers.service.js';

describe('HttpHeadersService', () => {
  const fakeHttp = (handler: (url: string) => Response) =>
    ({
      target: vi.fn(async (url: string) => handler(url)),
    }) as unknown as HttpClientService;

  it('follows redirects and records each hop', async () => {
    const http = fakeHttp((url) =>
      url.startsWith('http:')
        ? new Response(null, {
            status: 301,
            headers: { location: 'https://a.test/' },
          })
        : new Response('ok', { status: 200 }),
    );
    const out = await new HttpHeadersService(http).inspect({
      target: 'http://a.test/',
      method: 'GET',
      followRedirects: true,
    });
    expect(out.hops.map((h) => h.status)).toEqual([301, 200]);
    expect(out.finalUrl).toBe('https://a.test/');
  });

  it('routes every redirect hop through the guarded client', async () => {
    const http = fakeHttp((url) => {
      if (url.includes('127.0.0.1'))
        throw new NotFoundException('unresolvable');
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/' },
      });
    });
    await expect(
      new HttpHeadersService(http).inspect({
        target: 'https://public.test/',
        method: 'GET',
        followRedirects: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
