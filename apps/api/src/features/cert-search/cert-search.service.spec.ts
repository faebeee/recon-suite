import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { CertSearchService } from './cert-search.service.js';

const fakeHttp = (impl: () => Promise<Response>) => {
  const trusted = vi.fn(impl);
  return { trusted, http: { trusted } as unknown as HttpClientService };
};

describe('CertSearchService', () => {
  it('queries crt.sh by organisation and aggregates the rows', async () => {
    const body = JSON.stringify([
      {
        common_name: 'www.example.com',
        name_value: 'Example Inc',
        serial_number: '01',
        issuer_ca_id: 1,
        not_before: '2026-01-01T00:00:00',
        not_after: '2999-01-01T00:00:00',
      },
    ]);
    const { http, trusted } = fakeHttp(async () => new Response(body));
    const out = await new CertSearchService(http).search({
      target: 'Example Inc & Co',
      includeExpired: false,
    });
    const [[href]] = trusted.mock.calls as unknown as [[string]];
    const url = new URL(href);
    expect(url.host).toBe('crt.sh');
    expect(url.searchParams.get('O')).toBe('Example Inc & Co');
    expect(url.searchParams.has('exclude')).toBe(false);
    expect(out).toMatchObject({
      organisation: 'Example Inc & Co',
      source: 'crt.sh',
      certificates: 1,
      apexDomains: ['example.com'],
    });
  });

  it('treats an empty answer as no results', async () => {
    const { http } = fakeHttp(async () => new Response('[]'));
    const out = await new CertSearchService(http).search({
      target: 'Nobody',
      includeExpired: true,
    });
    expect(out).toMatchObject({
      certificates: 0,
      domains: [],
      apexDomains: [],
    });
  });

  it('maps upstream errors and timeouts', async () => {
    const bad = fakeHttp(async () => new Response('busy', { status: 502 }));
    await expect(
      new CertSearchService(bad.http).search({
        target: 'X Inc',
        includeExpired: false,
      }),
    ).rejects.toThrow(/crt\.sh responded 502.*often slow/);

    const slow = fakeHttp(async () => {
      throw new GatewayTimeoutException('Request to crt.sh timed out');
    });
    await expect(
      new CertSearchService(slow.http).search({
        target: 'X Inc',
        includeExpired: false,
      }),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);

    const html = fakeHttp(async () => new Response('<html>'));
    await expect(
      new CertSearchService(html.http).search({
        target: 'X Inc',
        includeExpired: false,
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
