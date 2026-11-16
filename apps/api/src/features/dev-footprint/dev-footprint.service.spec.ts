import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import { DevFootprintService } from './dev-footprint.service.js';

/** Fake trusted client: answers by URL prefix, 404 for anything unknown. */
function fakeHttp(routes: Record<string, () => Response>) {
  const trusted = vi.fn(async (url: string) => {
    const hit = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((prefix) => url.startsWith(prefix));
    return hit ? routes[hit]!() : new Response('{}', { status: 404 });
  });
  const target = vi.fn();
  return {
    http: { trusted, target } as unknown as HttpClientService,
    trusted,
    target,
  };
}

describe('DevFootprintService', () => {
  it('derives the handle from a domain and queries every platform as data only', async () => {
    const { http, trusted, target } = fakeHttp({
      'https://api.github.com/orgs/acme/repos': () =>
        Response.json([
          {
            name: 'web',
            html_url: 'https://github.com/acme/web',
            pushed_at: '2026-11-01T00:00:00Z',
          },
        ]),
      'https://api.github.com/orgs/acme': () =>
        Response.json({
          login: 'acme',
          html_url: 'https://github.com/acme',
          public_repos: 1,
          is_verified: true,
        }),
      'https://registry.npmjs.org/acme/latest': () =>
        Response.json({
          name: 'acme',
          version: '1.0.0',
          homepage: 'https://acme.com',
        }),
      'https://registry.npmjs.org/-/org/acme/package': () =>
        Response.json({ '@acme/ui': 'write', acme: 'write' }),
      'https://registry.npmjs.org/-/v1/search': () =>
        Response.json({
          total: 2,
          objects: [
            {
              package: {
                name: '@acme/ui',
                version: '1.0.0',
                date: '2026-01-01',
              },
            },
            { package: { name: 'unrelated', version: '1.0.0' } },
          ],
        }),
    });
    const out = await new DevFootprintService(http).lookup({
      target: 'www.acme.com',
    });

    expect(out).toMatchObject({ handle: 'acme', domain: 'acme.com' });
    expect(target).not.toHaveBeenCalled();
    const hosts = new Set(trusted.mock.calls.map(([u]) => new URL(u).host));
    expect([...hosts].sort()).toEqual([
      'api.github.com',
      'gitlab.com',
      'hub.docker.com',
      'pypi.org',
      'registry.npmjs.org',
    ]);
    const byPlatform = Object.fromEntries(
      out.platforms.map((p) => [p.platform, p]),
    );
    expect(byPlatform.github).toMatchObject({
      status: 'found',
      items: [{ name: 'web' }],
    });
    expect(byPlatform.gitlab?.status).toBe('not-found');
    expect(byPlatform.npm).toMatchObject({
      status: 'found',
      totalItems: 2,
      items: [{ name: '@acme/ui' }],
      namesake: { linkedToOrg: true, ownedByOrg: true },
    });
    expect(trusted.mock.calls.map(([u]) => u)).toContain(
      'https://registry.npmjs.org/-/v1/search?text=%40acme%2F&size=100',
    );
    expect(byPlatform.pypi?.namesake).toBeNull();
    // A personal account lookup only happens when there is no organisation.
    expect(trusted.mock.calls.some(([u]) => u.includes('/users/'))).toBe(false);
  });

  it('reports a GitHub user account without fetching its repositories', async () => {
    const { http, trusted } = fakeHttp({
      'https://api.github.com/users/acme': () =>
        Response.json({ login: 'acme', type: 'User' }),
    });
    const out = await new DevFootprintService(http).lookup({ target: 'acme' });
    expect(out.platforms[0]).toEqual({
      platform: 'github',
      status: 'found',
      account: { kind: 'user', url: 'https://github.com/acme' },
      items: [],
    });
    expect(trusted.mock.calls.some(([u]) => u.includes('/users/acme/'))).toBe(
      false,
    );
  });

  it('keeps going when one platform fails, with a readable reason', async () => {
    const { http } = fakeHttp({
      'https://api.github.com/': () =>
        new Response('{}', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        }),
    });
    const out = await new DevFootprintService(http).lookup({ target: 'acme' });
    expect(out.platforms[0]).toMatchObject({
      status: 'error',
      error: expect.stringMatching(/GitHub rate limit/),
    });
    expect(out.platforms.slice(1).every((p) => p.status === 'not-found')).toBe(
      true,
    );
  });

  it('fails with 502 only when every platform fails', async () => {
    const { http } = fakeHttp({
      'https://': () => new Response('down', { status: 503 }),
    });
    await expect(
      new DevFootprintService(http).lookup({ target: 'acme' }),
    ).rejects.toThrow(BadGatewayException);
  });

  it('asks for a handle when none can be derived', async () => {
    const { http } = fakeHttp({});
    await expect(
      new DevFootprintService(http).lookup({ target: 'my_org.com' }),
    ).rejects.toThrow(BadRequestException);
  });
});
