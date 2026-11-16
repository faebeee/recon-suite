import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  type DevFootprintOutput,
  type DevFootprintParams,
  type FootprintPlatform,
  type FootprintPlatformResult,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextLimited } from '../../core/http/read-limited.js';
import {
  deriveHandle,
  footprintFindings,
  mapDockerRepos,
  mapGithubOrg,
  mapGithubRepos,
  mapGitlabGroup,
  mapGitlabProjects,
  mapNpmLatest,
  mapNpmOrgPackages,
  mapNpmScope,
  mapPypi,
} from './dev-footprint.parser.js';

const MAX_BYTES = 2 * 1024 * 1024;
/** PyPI's JSON lists every release, so it is larger. */
const MAX_PYPI_BYTES = 8 * 1024 * 1024;
const GITHUB_HEADERS = {
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
};

type Got = { status: 200; json: unknown } | { status: 404 };

/**
 * Passive: only the public APIs of GitHub, GitLab, npm, PyPI and Docker Hub are
 * queried with the handle as data; the target organisation's systems are never
 * contacted. Organisation-level only: no member lists, no personal profiles.
 */
@Injectable()
export class DevFootprintService {
  constructor(private readonly http: HttpClientService) {}

  async lookup({ target }: DevFootprintParams): Promise<DevFootprintOutput> {
    const derived = deriveHandle(target);
    if (!derived) {
      throw new BadRequestException(
        `Could not derive an organisation handle from "${target}"; enter the handle itself (e.g. acme).`,
      );
    }
    const { handle, domain } = derived;
    const h = encodeURIComponent(handle);

    const platforms = await Promise.all([
      this.platform('github', () => this.github(h)),
      this.platform('gitlab', () => this.gitlab(h)),
      this.platform('npm', () => this.npm(h, handle, domain)),
      this.platform('pypi', () => this.pypi(h, handle, domain)),
      this.platform('dockerhub', () => this.dockerhub(h, handle)),
    ]);
    if (platforms.every((p) => p.status === 'error')) {
      throw new BadGatewayException(
        `All platform lookups failed (${platforms[0]?.error ?? 'unknown error'})`,
      );
    }
    return {
      query: target,
      handle,
      ...(domain && { domain }),
      platforms,
      findings: footprintFindings(platforms, handle),
    };
  }

  private async platform(
    platform: FootprintPlatform,
    run: () => Promise<Omit<FootprintPlatformResult, 'platform'>>,
  ): Promise<FootprintPlatformResult> {
    try {
      return { platform, ...(await run()) };
    } catch (err) {
      return {
        platform,
        status: 'error',
        items: [],
        error: (err as Error).message,
      };
    }
  }

  private async github(h: string) {
    const org = await this.get(
      `https://api.github.com/orgs/${h}`,
      GITHUB_HEADERS,
    );
    if (org.status === 404) {
      // A personal account with that name: report that it exists, nothing more.
      const user = await this.get(
        `https://api.github.com/users/${h}`,
        GITHUB_HEADERS,
      );
      return user.status === 404
        ? { status: 'not-found' as const, items: [] }
        : {
            status: 'found' as const,
            account: { kind: 'user' as const, url: `https://github.com/${h}` },
            items: [],
          };
    }
    const account = mapGithubOrg(org.json);
    if (!account) throw new Error('unexpected GitHub response');
    const repos = await this.get(
      `https://api.github.com/orgs/${h}/repos?type=public&sort=pushed&per_page=30`,
      GITHUB_HEADERS,
    );
    return {
      status: 'found' as const,
      account,
      items: repos.status === 404 ? [] : mapGithubRepos(repos.json),
      totalItems: account.publicRepos,
    };
  }

  private async gitlab(h: string) {
    const group = await this.get(
      `https://gitlab.com/api/v4/groups/${h}?with_projects=false`,
    );
    if (group.status === 404)
      return { status: 'not-found' as const, items: [] };
    const mapped = mapGitlabGroup(group.json);
    if (!mapped) throw new Error('unexpected GitLab response');
    const { id, ...account } = mapped;
    const projects = await this.get(
      `https://gitlab.com/api/v4/groups/${id}/projects?per_page=30&order_by=last_activity_at&sort=desc&visibility=public`,
    );
    return {
      status: 'found' as const,
      account,
      items: projects.status === 404 ? [] : mapGitlabProjects(projects.json),
    };
  }

  private async npm(h: string, handle: string, domain?: string) {
    // The org endpoint is public: 404 ("Scope not found") means nobody owns the scope.
    const [org, latest] = await Promise.all([
      this.get(`https://registry.npmjs.org/-/org/${h}/package`),
      this.get(`https://registry.npmjs.org/${h}/latest`),
    ]);
    const owned = org.status === 404 ? [] : mapNpmOrgPackages(org.json);
    // Details (description, date) of the scoped packages come from the search index.
    const search =
      org.status === 404
        ? undefined
        : await this.get(
            `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(`@${handle}/`)}&size=100`,
          );
    const { items } =
      search?.status === 200 ? mapNpmScope(search.json, handle) : { items: [] };
    const mapped =
      latest.status === 404
        ? undefined
        : mapNpmLatest(latest.json, handle, domain);
    return {
      status: org.status === 404 ? ('not-found' as const) : ('found' as const),
      ...(org.status !== 404 && {
        account: {
          kind: 'scope' as const,
          url: `https://www.npmjs.com/org/${h}`,
        },
      }),
      items,
      totalItems: owned.length,
      namesake: mapped
        ? { ...mapped, ownedByOrg: owned.includes(mapped.name) }
        : null,
    };
  }

  private async pypi(h: string, handle: string, domain?: string) {
    const res = await this.get(
      `https://pypi.org/pypi/${h}/json`,
      {},
      MAX_PYPI_BYTES,
    );
    const namesake =
      res.status === 404 ? null : (mapPypi(res.json, handle, domain) ?? null);
    return {
      status: namesake ? ('found' as const) : ('not-found' as const),
      items: [],
      namesake,
    };
  }

  private async dockerhub(h: string, handle: string) {
    const res = await this.get(
      `https://hub.docker.com/v2/repositories/${h}/?page_size=30&ordering=last_updated`,
    );
    if (res.status === 404) return { status: 'not-found' as const, items: [] };
    const { items, total } = mapDockerRepos(res.json, handle);
    return {
      status: items.length ? ('found' as const) : ('not-found' as const),
      ...(items.length && {
        account: {
          kind: 'namespace' as const,
          url: `https://hub.docker.com/u/${h}`,
        },
      }),
      items,
      totalItems: total,
    };
  }

  /** GET a fixed third-party JSON API; 404 is a normal "not found" answer. */
  private async get(
    url: string,
    headers: Record<string, string> = {},
    maxBytes = MAX_BYTES,
  ): Promise<Got> {
    const res = await this.http.trusted(url, {
      headers: { accept: 'application/json', ...headers },
      timeoutMs: 15_000,
    });
    if (res.status === 404) {
      await res.body?.cancel();
      return { status: 404 };
    }
    if (!res.ok) {
      await res.body?.cancel();
      const host = new URL(url).host;
      if (
        res.status === 429 ||
        (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')
      ) {
        throw new Error(
          host === 'api.github.com'
            ? 'GitHub rate limit reached (60 requests per hour without a token); try again later'
            : `${host} rate limit reached; try again later`,
        );
      }
      throw new Error(`${host} responded ${res.status}`);
    }
    try {
      return {
        status: 200,
        json: JSON.parse(await readTextLimited(res, maxBytes)),
      };
    } catch (err) {
      throw new Error(
        err instanceof SyntaxError
          ? `${new URL(url).host} returned invalid JSON`
          : `${new URL(url).host}: ${(err as Error).message}`,
      );
    }
  }
}
