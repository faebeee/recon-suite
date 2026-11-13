import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { Response } from 'undici';
import type { Env } from '../../config/env.js';
import { ReverseIpService, type FetchLike } from './reverse-ip.service.js';

const fixture = readFileSync(
  new URL('./securitytrails-fixture.json', import.meta.url),
  'utf8',
);

const make = (key: string | undefined, res: () => Response) => {
  const service = new ReverseIpService({
    get: vi.fn(() => key),
  } as unknown as ConfigService<Env, true>);
  const fetchImpl = vi.fn(async () => res());
  service.fetchImpl = fetchImpl as unknown as FetchLike;
  return { service, fetchImpl };
};

describe('ReverseIpService', () => {
  it('needs an API key', async () => {
    const { service, fetchImpl } = make(undefined, () => new Response(fixture));
    await expect(
      service.lookup({ target: '93.184.215.14' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts an ipv4 filter to the fixed SecurityTrails endpoint', async () => {
    const { service, fetchImpl } = make('st-key', () => new Response(fixture));
    const out = await service.lookup({ target: '93.184.215.14' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      {
        method: string;
        headers: Record<string, string>;
        body: string;
        redirect: string;
      },
    ];
    expect(url).toBe('https://api.securitytrails.com/v1/domains/list');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(init.headers.APIKEY).toBe('st-key');
    expect(JSON.parse(init.body)).toEqual({
      filter: { ipv4: '93.184.215.14' },
    });
    expect(out).toEqual({
      ip: '93.184.215.14',
      source: 'securitytrails',
      total: 1234,
      domains: ['example.com', 'example.net', 'example.org'],
      truncated: true,
    });
  });

  it('uses the ipv6 filter for IPv6 literals', async () => {
    const { service, fetchImpl } = make(
      'k',
      () => new Response('{"records":[]}'),
    );
    await service.lookup({ target: '2606:2800:21f:cb07:6820:80da:af6b:8b2c' });
    const [[, init]] = fetchImpl.mock.calls as unknown as [
      [string, { body: string }],
    ];
    expect(JSON.parse(init.body)).toEqual({
      filter: { ipv6: '2606:2800:21f:cb07:6820:80da:af6b:8b2c' },
    });
  });

  it.each([
    [401, BadGatewayException],
    [403, BadGatewayException],
    [429, ServiceUnavailableException],
    [400, BadRequestException],
    [500, BadGatewayException],
  ])('maps status %i', async (status, Err) => {
    const { service } = make(
      'k',
      () => new Response('{"message":"nope"}', { status }),
    );
    await expect(
      service.lookup({ target: '93.184.215.14' }),
    ).rejects.toBeInstanceOf(Err);
  });

  it('reports network failures as bad gateway', async () => {
    const { service, fetchImpl } = make('k', () => new Response(''));
    fetchImpl.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(
      service.lookup({ target: '93.184.215.14' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
