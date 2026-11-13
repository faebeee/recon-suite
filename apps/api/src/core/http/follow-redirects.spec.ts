import { Response } from 'undici';
import { followRedirects } from './follow-redirects.js';

describe('followRedirects', () => {
  it('follows relative and absolute locations through send()', async () => {
    const send = vi.fn(async (url: string) => {
      if (url === 'http://a.test/') {
        return new Response(null, { status: 301, headers: { location: '/x' } });
      }
      if (url === 'http://a.test/x') {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://b.test/y' },
        });
      }
      return new Response('ok', { status: 200 });
    });
    const out = await followRedirects(send, 'http://a.test/');
    expect(send.mock.calls.map(([u]) => u)).toEqual([
      'http://a.test/',
      'http://a.test/x',
      'https://b.test/y',
    ]);
    expect(out.finalUrl).toBe('https://b.test/y');
    expect(out.redirects).toBe(2);
    expect(out.res.status).toBe(200);
  });

  it('stops at the redirect limit', async () => {
    const send = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: '/loop' } }),
    );
    const out = await followRedirects(send, 'https://a.test/', 3);
    expect(send).toHaveBeenCalledTimes(4);
    expect(out.res.status).toBe(302);
  });

  it('does not follow non-http schemes', async () => {
    const send = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'file:///etc/passwd' },
        }),
    );
    const out = await followRedirects(send, 'https://a.test/');
    expect(send).toHaveBeenCalledTimes(1);
    expect(out.finalUrl).toBe('https://a.test/');
  });
});

describe('readTextPrefix', () => {
  it('truncates long bodies and keeps short ones whole', async () => {
    const { readTextPrefix } = await import('./read-limited.js');
    const long = await readTextPrefix(new Response('x'.repeat(100)), 10);
    expect(long).toEqual({ text: 'x'.repeat(10), truncated: true });
    const short = await readTextPrefix(new Response('hello'), 10);
    expect(short).toEqual({ text: 'hello', truncated: false });
  });
});

describe('readTextLimited', () => {
  it('throws 413 instead of a locked-stream error when the body is too large', async () => {
    const { readTextLimited } = await import('./read-limited.js');
    const { PayloadTooLargeException } = await import('@nestjs/common');
    await expect(
      readTextLimited(new Response('x'.repeat(5000)), 1024),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });
});
