import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { followRedirects } from '../../core/http/follow-redirects.js';
import { shodanFaviconHash } from './favicon-hash.hash.js';
import { FaviconHashService } from './favicon-hash.service.js';

const ICO = Buffer.from('000001000100101000000100', 'hex');

describe('FaviconHashService', () => {
  it('hashes /favicon.ico and linked icons, skipping catch-all pages', async () => {
    const target = vi.fn(async (url: string): Promise<Response> => {
      if (url === 'https://x.test/') {
        return new Response(
          '<link rel="icon" href="/missing.png"><link rel="icon" href="/favicon.ico">',
          { status: 200 },
        );
      }
      if (url === 'https://x.test/favicon.ico') {
        return new Response(ICO, {
          status: 200,
          headers: { 'content-type': 'image/x-icon' },
        });
      }
      return new Response('<!doctype html><title>Home</title>', {
        status: 200,
      });
    });
    const http = {
      targetFollow: (u: string) => followRedirects((v) => target(v), u),
    } as unknown as HttpClientService;

    const out = await new FaviconHashService(http).hash({
      target: 'https://x.test/',
    });
    expect(out.icons.map((i) => [i.url, i.source])).toEqual([
      ['https://x.test/favicon.ico', 'default'],
      ['https://x.test/missing.png', 'link'],
    ]);
    const [ico, missing] = out.icons;
    expect(ico?.mmh3).toBe(shodanFaviconHash(ICO));
    expect(ico?.queries?.[0]?.query).toBe(`http.favicon.hash:${ico?.mmh3}`);
    expect(missing?.mmh3).toBeUndefined();
    expect(missing?.error).toMatch(/Not an image/);
  });
});
