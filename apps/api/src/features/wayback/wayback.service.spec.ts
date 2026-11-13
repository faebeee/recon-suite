import { GatewayTimeoutException } from '@nestjs/common';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { cdxUrl, WaybackService } from './wayback.service.js';

const http = (impl: (url: string) => Promise<Response>) => {
  const trusted = vi.fn(impl);
  return {
    trusted,
    svc: new WaybackService({ trusted } as unknown as HttpClientService),
  };
};

const params = { target: 'x.test', includeSubdomains: false, limit: 1000 };

describe('cdxUrl', () => {
  it('queries the path prefix by default and the domain with subdomains', () => {
    const a = new URL(cdxUrl(params));
    expect(a.host).toBe('web.archive.org');
    expect(a.searchParams.get('url')).toBe('x.test/*');
    expect(a.searchParams.get('matchType')).toBeNull();
    expect(a.searchParams.get('collapse')).toBe('urlkey');
    expect(a.searchParams.get('limit')).toBe('1000');
    const b = new URL(cdxUrl({ ...params, includeSubdomains: true }));
    expect(b.searchParams.get('url')).toBe('x.test');
    expect(b.searchParams.get('matchType')).toBe('domain');
  });
});

describe('WaybackService', () => {
  it('parses the archive response', async () => {
    const { svc, trusted } = http(async () =>
      Response.json([
        ['original', 'timestamp', 'statuscode', 'mimetype'],
        ['http://x.test/.env', '20200101000000', '200', 'text/plain'],
      ]),
    );
    const out = await svc.lookup(params);
    expect(trusted).toHaveBeenCalledOnce();
    expect(out.total).toBe(1);
    expect(out.interesting[0]?.reason).toBe('secret file');
  });

  it('handles an empty body and an empty array', async () => {
    expect(
      (await http(async () => new Response('')).svc.lookup(params)).total,
    ).toBe(0);
    expect(
      (await http(async () => Response.json([])).svc.lookup(params)).total,
    ).toBe(0);
  });

  it('maps upstream failures to 502 with a hint', async () => {
    await expect(
      http(
        async () => new Response('<html>offline</html>', { status: 503 }),
      ).svc.lookup(params),
    ).rejects.toThrow(/responded 503.*often slow/);
    await expect(
      http(async () => new Response('<html>hi</html>')).svc.lookup(params),
    ).rejects.toThrow(/unexpected response/);
  });

  it('maps timeouts to 504', async () => {
    await expect(
      http(async () => {
        throw new GatewayTimeoutException(
          'Request to web.archive.org timed out',
        );
      }).svc.lookup(params),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
  });
});
