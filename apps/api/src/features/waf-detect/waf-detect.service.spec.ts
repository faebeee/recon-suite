import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { followRedirects } from '../../core/http/follow-redirects.js';
import { WafDetectService } from './waf-detect.service.js';

/** Cloudflare-fronted site that blocks the trigger request. */
const fakeHttp = () => {
  const urls: string[] = [];
  const target = vi.fn(async (url: string): Promise<Response> => {
    urls.push(url);
    if (url.includes('recon_waf_test')) {
      return new Response('<title>Attention Required! | Cloudflare</title>', {
        status: 403,
        headers: { 'cf-ray': '1', server: 'cloudflare' },
      });
    }
    return new Response('hi', { status: 200, headers: { 'cf-ray': '1' } });
  });
  const http = {
    target,
    targetFollow: (u: string) => followRedirects((v) => target(v), u),
  } as unknown as HttpClientService;
  return { http, urls };
};

describe('WafDetectService', () => {
  it('detects the edge and the block', async () => {
    const { http, urls } = fakeHttp();
    const out = await new WafDetectService(http).detect({
      target: 'https://x.test/?a=1',
      probe: true,
    });
    expect(urls[1]).toMatch(/^https:\/\/x\.test\/\?a=1&recon_waf_test=1/);
    expect(out.probe?.blocked).toBe(true);
    expect(out.detections[0]?.evidence).toContain('Cloudflare block page');
  });

  it('sends a single plain request without the probe', async () => {
    const { http, urls } = fakeHttp();
    const out = await new WafDetectService(http).detect({
      target: 'https://x.test/',
      probe: false,
    });
    expect(urls).toEqual(['https://x.test/']);
    expect(out.probe).toBeUndefined();
  });
});
