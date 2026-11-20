import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { CookieAuditService } from './cookie-audit.service.js';

/** http -> https redirect that sets a tracking cookie, then a login page with a session. */
const fakeHttp = () => {
  const target = vi.fn(
    async (url: string, _opts?: { redirect?: string }): Promise<Response> => {
      if (url === 'http://x.test/') {
        return new Response(null, {
          status: 301,
          headers: [
            ['location', 'https://x.test/login'],
            ['set-cookie', 'track=1; Max-Age=600'],
          ],
        });
      }
      return new Response('ok', {
        status: 200,
        headers: [
          ['set-cookie', 'sid=old; Path=/'],
          ['set-cookie', 'sid=new; Path=/; Secure; HttpOnly; SameSite=Lax'],
        ],
      });
    },
  );
  return { http: { target } as unknown as HttpClientService, target };
};

describe('CookieAuditService', () => {
  it('collects cookies from every hop, deduplicated, without their values', async () => {
    const { http, target } = fakeHttp();
    const out = await new CookieAuditService(http).audit({
      target: 'http://x.test/',
    });
    expect(target).toHaveBeenCalledTimes(2);
    expect(target.mock.calls.every(([, o]) => o?.redirect === 'manual')).toBe(
      true,
    );
    expect(out.finalUrl).toBe('https://x.test/login');
    expect(out.hops.map((h) => h.cookies)).toEqual([1, 2]);
    expect(out.cookies.map((c) => c.name)).toEqual(['track', 'sid']);

    const track = out.cookies[0];
    expect(track?.setBy).toBe('http://x.test/');
    expect(track?.checks.find((c) => c.id === 'secure')?.message).toMatch(
      /plain HTTP/,
    );
    const sid = out.cookies[1];
    expect(sid?.httpOnly).toBe(true);
    expect(sid?.valueLength).toBe(3);
    expect(JSON.stringify(out)).not.toContain('new');
    expect(out.grade).not.toBeNull();
  });
});
