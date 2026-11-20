import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { followRedirects } from '../../core/http/follow-redirects.js';
import { ApiDiscoveryService, probeBases } from './api-discovery.service.js';

describe('probeBases', () => {
  it('adds the path prefix when there is one', () => {
    expect(probeBases('https://x.test/')).toEqual(['https://x.test']);
    expect(probeBases('https://x.test/v2/')).toEqual([
      'https://x.test',
      'https://x.test/v2',
    ]);
  });
});

interface Opts {
  method?: string;
  body?: string;
}

describe('ApiDiscoveryService', () => {
  it('finds the spec, the docs page and GraphQL with introspection', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const target = vi.fn(
      async (url: string, o: Opts = {}): Promise<Response> => {
        calls.push({ url, method: o.method ?? 'GET', body: o.body });
        const path = new URL(url).pathname;
        if (path === '/v3/api-docs') {
          return new Response(
            JSON.stringify({
              openapi: '3.0.0',
              info: { title: 'T' },
              paths: { '/a': { get: {} } },
            }),
          );
        }
        if (path === '/swagger-ui.html')
          return new Response('<div id="swagger-ui">');
        if (path === '/graphql') {
          return new Response(
            JSON.stringify({
              data: { __schema: { queryType: { fields: [{ name: 'me' }] } } },
            }),
          );
        }
        // Catch-all SPA: 200 with HTML for every path.
        return new Response('<!doctype html><div id="app">', { status: 200 });
      },
    );
    const http = {
      target,
      targetFollow: (u: string) => followRedirects((v) => target(v), u),
    } as unknown as HttpClientService;

    const out = await new ApiDiscoveryService(http).discover({
      target: 'https://x.test/app',
    });
    expect(out.origin).toBe('https://x.test');
    expect(out.specs.map((s) => s.url)).toEqual(['https://x.test/v3/api-docs']);
    expect(out.docPages).toEqual(['https://x.test/swagger-ui.html']);
    expect(out.graphql).toEqual([
      {
        url: 'https://x.test/graphql',
        introspection: true,
        queries: ['me'],
        mutations: [],
      },
    ]);
    const gql = calls.filter((c) => c.url.endsWith('graphql'));
    expect(
      gql.every((c) => c.method === 'POST' && c.body?.includes('__schema')),
    ).toBe(true);
    expect(
      calls.filter((c) => c.method !== 'GET' && !c.url.endsWith('graphql')),
    ).toEqual([]);
    expect(out.probes.filter((p) => p.found)).toHaveLength(3);
    // /app prefix is probed too (nothing there in this fake).
    expect(out.probes.some((p) => p.path === '/app/openapi.json')).toBe(true);
  });
});
