import { readFileSync } from 'node:fs';
import { MAX_REVERSE_IP_DOMAINS } from '@recon/shared';
import {
  mapDomainsList,
  type StDomainsListResponse,
} from './securitytrails.mapper.js';

/** Shape of a SecurityTrails /v1/domains/list response, trimmed. */
const fixture = JSON.parse(
  readFileSync(
    new URL('./securitytrails-fixture.json', import.meta.url),
    'utf8',
  ),
) as StDomainsListResponse;

describe('mapDomainsList', () => {
  it('collects distinct lowercase hostnames and keeps the reported total', () => {
    expect(mapDomainsList(fixture)).toEqual({
      total: 1234,
      domains: ['example.com', 'example.net', 'example.org'],
      truncated: true,
    });
  });

  it('is not truncated when everything fits', () => {
    expect(
      mapDomainsList({ record_count: 1, records: [{ hostname: 'a.test' }] }),
    ).toEqual({ total: 1, domains: ['a.test'], truncated: false });
  });

  it('handles an empty answer', () => {
    expect(mapDomainsList({})).toEqual({
      total: 0,
      domains: [],
      truncated: false,
    });
  });

  it('caps the list', () => {
    const records = Array.from(
      { length: MAX_REVERSE_IP_DOMAINS + 20 },
      (_, i) => ({
        hostname: `h${String(i).padStart(4, '0')}.test`,
      }),
    );
    const out = mapDomainsList({ records, record_count: records.length });
    expect(out.domains).toHaveLength(MAX_REVERSE_IP_DOMAINS);
    expect(out.truncated).toBe(true);
  });
});
