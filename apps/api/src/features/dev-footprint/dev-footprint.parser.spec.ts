import type { FootprintPlatformResult } from '@recon/shared';
import {
  deriveHandle,
  footprintFindings,
  linksToOrg,
  mapDockerRepos,
  mapGithubOrg,
  mapGithubRepos,
  mapNpmLatest,
  mapNpmOrgPackages,
  mapNpmScope,
  mapPypi,
} from './dev-footprint.parser.js';

describe('deriveHandle', () => {
  it.each([
    ['acme', { handle: 'acme' }],
    ['acme.com', { handle: 'acme', domain: 'acme.com' }],
    ['www.shop.acme.co.uk', { handle: 'acme', domain: 'acme.co.uk' }],
    ['my-org.io', { handle: 'my-org', domain: 'my-org.io' }],
  ])('%s', (input, want) => expect(deriveHandle(input)).toEqual(want));

  it('gives up on names that are not valid handles', () => {
    expect(deriveHandle('_dmarc.example')).toBeUndefined();
    expect(deriveHandle('-bad')).toBeUndefined();
  });
});

describe('GitHub mappers', () => {
  it('maps the organisation', () => {
    expect(
      mapGithubOrg({
        login: 'acme',
        name: 'ACME',
        html_url: 'https://github.com/acme',
        blog: 'https://acme.com',
        is_verified: false,
        public_repos: 42,
        members_url: 'ignored',
      }),
    ).toEqual({
      kind: 'organization',
      url: 'https://github.com/acme',
      name: 'ACME',
      website: 'https://acme.com',
      verified: false,
      publicRepos: 42,
    });
    expect(mapGithubOrg({ message: 'Not Found' })).toBeUndefined();
  });

  it('maps repositories, newest push first, dropping junk', () => {
    const repos = mapGithubRepos([
      {
        name: 'old',
        html_url: 'https://github.com/acme/old',
        pushed_at: '2019-01-01T00:00:00Z',
        archived: false,
      },
      {
        name: 'new',
        html_url: 'https://github.com/acme/new',
        pushed_at: '2026-11-01T00:00:00Z',
        fork: true,
        stargazers_count: 3,
      },
      { name: 'bad', html_url: 'javascript:alert(1)' },
      'nope',
    ]);
    expect(repos.map((r) => r.name)).toEqual(['new', 'old']);
    expect(repos[0]).toMatchObject({ fork: true, stars: 3 });
  });
});

describe('npm / PyPI mappers', () => {
  it('keeps only packages in the scope', () => {
    expect(
      mapNpmScope(
        {
          total: 2,
          objects: [
            {
              package: {
                name: '@acme/ui',
                version: '1.2.0',
                date: '2026-01-01',
              },
            },
            { package: { name: 'acme-ui-clone', version: '0.0.1' } },
          ],
        },
        'acme',
      ),
    ).toEqual({
      items: [
        {
          name: '@acme/ui',
          url: 'https://www.npmjs.com/package/@acme/ui',
          version: '1.2.0',
          updatedAt: '2026-01-01',
        },
      ],
      total: 2,
    });
  });

  it('links a namesake to the org by GitHub owner or domain', () => {
    expect(
      mapNpmLatest(
        {
          name: 'acme',
          version: '2.0.0',
          repository: { url: 'git+https://github.com/acme/acme.git' },
        },
        'acme',
      ),
    ).toMatchObject({
      links: ['https://github.com/acme/acme'],
      linkedToOrg: true,
    });
    expect(
      mapNpmLatest(
        { name: 'acme', repository: 'git@github.com:someone/acme.git' },
        'acme',
        'acme.com',
      ),
    ).toMatchObject({
      links: ['https://github.com/someone/acme'],
      linkedToOrg: false,
    });
    expect(
      mapPypi(
        {
          info: {
            name: 'acme',
            version: '1.0',
            project_urls: { Homepage: 'https://docs.acme.com/' },
          },
        },
        'acme',
        'acme.com',
      ),
    ).toMatchObject({
      url: 'https://pypi.org/project/acme/',
      linkedToOrg: true,
    });
  });

  it('does not treat look-alike owners or hosts as the org', () => {
    expect(linksToOrg(['https://github.com/acme-fan/x'], 'acme')).toBe(false);
    expect(linksToOrg(['https://notacme.com'], 'acme', 'acme.com')).toBe(false);
    expect(linksToOrg(['not a url'], 'acme')).toBe(false);
  });
});

describe('mapNpmOrgPackages', () => {
  it('lists the package names an npm org owns', () => {
    expect(mapNpmOrgPackages({ '@acme/ui': 'write', acme: 'read' })).toEqual([
      '@acme/ui',
      'acme',
    ]);
    expect(mapNpmOrgPackages(['x'])).toEqual([]);
  });
});

describe('mapDockerRepos', () => {
  it('maps public images and skips private ones', () => {
    expect(
      mapDockerRepos(
        {
          count: 3,
          results: [
            {
              name: 'api',
              last_updated: '2026-10-01T00:00:00Z',
              pull_count: 1000,
            },
            { name: 'secret', is_private: true },
          ],
        },
        'acme',
      ),
    ).toEqual({
      items: [
        {
          name: 'api',
          url: 'https://hub.docker.com/r/acme/api',
          updatedAt: '2026-10-01T00:00:00Z',
          pulls: 1000,
        },
      ],
      total: 3,
    });
  });
});

describe('footprintFindings', () => {
  const now = Date.parse('2026-11-16T00:00:00Z');
  const base = (
    p: Partial<FootprintPlatformResult> &
      Pick<FootprintPlatformResult, 'platform'>,
  ) => ({ status: 'found', items: [], ...p }) as FootprintPlatformResult;

  it('reports accounts, stale code and namesakes', () => {
    const f = footprintFindings(
      [
        base({
          platform: 'github',
          account: {
            kind: 'organization',
            url: 'https://github.com/acme',
            verified: true,
            publicRepos: 2,
          },
          items: [
            { name: 'live', url: 'u', updatedAt: '2026-10-01T00:00:00Z' },
            { name: 'dusty', url: 'u', updatedAt: '2020-01-01T00:00:00Z' },
            {
              name: 'archived',
              url: 'u',
              updatedAt: '2018-01-01T00:00:00Z',
              archived: true,
            },
          ],
        }),
        base({ platform: 'gitlab', status: 'not-found' }),
        base({
          platform: 'npm',
          status: 'not-found',
          namesake: { name: 'acme', url: 'n', links: [], linkedToOrg: false },
        }),
        base({ platform: 'pypi', status: 'not-found', namesake: null }),
        base({ platform: 'dockerhub', status: 'error', error: 'boom' }),
      ],
      'acme',
      now,
    );
    expect(f.map((x) => [x.id, x.status])).toEqual([
      ['dev.github.account', 'info'],
      ['dev.github.stale', 'warn'],
      ['dev.gitlab.account', 'info'],
      ['dev.npm.scope', 'info'],
      ['dev.npm.namesake', 'warn'],
      ['dev.pypi.namesake', 'info'],
    ]);
    expect(f[1]).toMatchObject({
      title: '1 GitHub repository untouched for 2+ years',
      value: 'dusty',
    });
  });

  it('does not describe personal accounts beyond their existence', () => {
    const [f] = footprintFindings(
      [
        base({
          platform: 'github',
          account: { kind: 'user', url: 'https://github.com/acme' },
        }),
      ],
      'acme',
      now,
    );
    expect(f).toMatchObject({
      id: 'dev.github.account',
      title: '"acme" is a personal GitHub account',
    });
  });
});
