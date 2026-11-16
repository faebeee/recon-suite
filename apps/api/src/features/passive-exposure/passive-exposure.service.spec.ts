import { BadGatewayException } from '@nestjs/common';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { PassiveExposureService } from './passive-exposure.service.js';

describe('PassiveExposureService', () => {
  const fakeHttp = (handler: (url: string) => Response) => {
    const trusted = vi.fn(async (url: string) => handler(url));
    const target = vi.fn();
    return {
      http: { trusted, target } as unknown as HttpClientService,
      trusted,
      target,
    };
  };

  it('queries InternetDB through the trusted client, never the target', async () => {
    const { http, trusted, target } = fakeHttp(() =>
      Response.json({
        ip: '192.0.2.1',
        ports: [443, 3306],
        cpes: [],
        hostnames: [],
        tags: [],
        vulns: [],
      }),
    );
    const out = await new PassiveExposureService(http).lookup({
      target: '192.0.2.1',
    });
    expect(trusted).toHaveBeenCalledWith(
      'https://internetdb.shodan.io/192.0.2.1',
      expect.anything(),
    );
    expect(target).not.toHaveBeenCalled();
    expect(out.addresses[0]).toMatchObject({
      indexed: true,
      ports: [443, 3306],
      risky: [{ port: 3306, service: 'MySQL' }],
    });
    expect(out.findings).toEqual([
      expect.objectContaining({ id: 'exposure.port.3306', status: 'fail' }),
    ]);
  });

  it('treats 404 as "not indexed"', async () => {
    const { http } = fakeHttp(
      () =>
        new Response('{"detail":"No information available"}', { status: 404 }),
    );
    const out = await new PassiveExposureService(http).lookup({
      target: '192.0.2.1',
    });
    expect(out.addresses[0]).toMatchObject({ indexed: false, ports: [] });
    expect(out.findings[0]).toMatchObject({ id: 'exposure.indexed' });
  });

  it('fails with 502 when every lookup fails', async () => {
    const { http } = fakeHttp(() => new Response('slow down', { status: 429 }));
    await expect(
      new PassiveExposureService(http).lookup({ target: '192.0.2.1' }),
    ).rejects.toThrow(BadGatewayException);
  });
});
