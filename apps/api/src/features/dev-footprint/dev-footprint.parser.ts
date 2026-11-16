import {
  FOOTPRINT_PLATFORM_LABELS,
  MAX_FOOTPRINT_ITEMS,
  ORG_HANDLE_RE,
  type Finding,
  type FootprintAccount,
  type FootprintItem,
  type FootprintNamesake,
  type FootprintPlatformResult,
} from '@recon/shared';

// ------------------------------------------------------------ handle

/** Two-label public suffixes common enough to matter ("acme.co.uk" -> "acme"). */
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'co.jp',
  'ne.jp',
  'or.jp',
  'com.br',
  'com.cn',
  'com.mx',
  'co.za',
  'com.tr',
  'co.in',
  'co.kr',
  'com.sg',
  'com.hk',
  'co.il',
  'com.ar',
  'co.at',
  'or.at',
]);

/**
 * "acme" -> { handle: "acme" }; "www.acme.co.uk" -> { handle: "acme", domain }.
 * Undefined when no valid handle can be derived (the caller asks for one).
 */
export function deriveHandle(
  target: string,
): { handle: string; domain?: string } | undefined {
  if (!target.includes('.')) {
    return ORG_HANDLE_RE.test(target) ? { handle: target } : undefined;
  }
  const labels = target.split('.');
  const suffixLen = TWO_LABEL_SUFFIXES.has(labels.slice(-2).join('.')) ? 2 : 1;
  const handle = labels[labels.length - suffixLen - 1];
  if (!handle || !ORG_HANDLE_RE.test(handle)) return undefined;
  return { handle, domain: labels.slice(-suffixLen - 1).join('.') };
}

// ------------------------------------------------------------ helpers

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined;
const str = (v: unknown, max = 300) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
const httpUrl = (v: unknown) => {
  const s = str(v, 500);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
};
const byUpdated = (a: FootprintItem, b: FootprintItem) =>
  (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
const items = (list: unknown, map: (o: Obj) => FootprintItem | undefined) =>
  (Array.isArray(list) ? list : [])
    .map((x) => {
      const o = obj(x);
      return o ? map(o) : undefined;
    })
    .filter((x): x is FootprintItem => !!x)
    .sort(byUpdated)
    .slice(0, MAX_FOOTPRINT_ITEMS);

// ------------------------------------------------------------ GitHub

export function mapGithubOrg(json: unknown): FootprintAccount | undefined {
  const o = obj(json);
  const url = httpUrl(o?.html_url);
  if (!o || !url) return undefined;
  return {
    kind: 'organization',
    url,
    name: str(o.name) ?? str(o.login),
    description: str(o.description),
    website: str(o.blog, 500),
    location: str(o.location),
    createdAt: str(o.created_at),
    verified: bool(o.is_verified),
    publicRepos: num(o.public_repos),
  };
}

export function mapGithubRepos(json: unknown): FootprintItem[] {
  return items(json, (o) => {
    const name = str(o.name, 200);
    const url = httpUrl(o.html_url);
    if (!name || !url) return undefined;
    return {
      name,
      url,
      description: str(o.description),
      updatedAt: str(o.pushed_at),
      archived: bool(o.archived),
      fork: bool(o.fork),
      language: str(o.language, 50),
      stars: num(o.stargazers_count),
    };
  });
}

// ------------------------------------------------------------ GitLab

export function mapGitlabGroup(
  json: unknown,
): (FootprintAccount & { id: number }) | undefined {
  const o = obj(json);
  const url = httpUrl(o?.web_url);
  const id = num(o?.id);
  if (!o || !url || id === undefined) return undefined;
  return {
    id,
    kind: 'group',
    url,
    name: str(o.name),
    description: str(o.description),
    createdAt: str(o.created_at),
  };
}

export function mapGitlabProjects(json: unknown): FootprintItem[] {
  return items(json, (o) => {
    const name = str(o.name, 200);
    const url = httpUrl(o.web_url);
    if (!name || !url) return undefined;
    return {
      name,
      url,
      description: str(o.description),
      updatedAt: str(o.last_activity_at),
      archived: bool(o.archived),
      stars: num(o.star_count),
    };
  });
}

// ------------------------------------------------------------ npm / PyPI

/** Package names owned by an npm organisation (`/-/org/<org>/package`). */
export function mapNpmOrgPackages(json: unknown): string[] {
  const o = obj(json);
  return o
    ? Object.keys(o)
        .filter((k) => k.length <= 214)
        .slice(0, 10_000)
    : [];
}

export function mapNpmScope(
  json: unknown,
  handle: string,
): { items: FootprintItem[]; total: number } {
  const o = obj(json);
  const prefix = `@${handle}/`;
  const list = (Array.isArray(o?.objects) ? o.objects : []).map(
    (x) => obj(obj(x)?.package) ?? {},
  );
  const mapped = items(list, (p) => {
    const name = str(p.name, 214);
    if (!name?.startsWith(prefix)) return undefined;
    return {
      name,
      url: `https://www.npmjs.com/package/${name}`,
      description: str(p.description),
      updatedAt: str(p.date),
      version: str(p.version, 50),
    };
  });
  return { items: mapped, total: Math.max(mapped.length, num(o?.total) ?? 0) };
}

/** Normalised repository/homepage URL: "git+https://github.com/a/b.git" -> "https://github.com/a/b". */
function cleanLink(v: unknown): string | undefined {
  const raw = typeof v === 'string' ? v : str(obj(v)?.url, 500);
  if (!raw) return undefined;
  const s = raw
    .trim()
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '');
  return /^https?:\/\//i.test(s) ? s.slice(0, 500) : undefined;
}

/** A link points at the organisation: its GitHub/GitLab handle or its domain. */
export function linksToOrg(
  links: string[],
  handle: string,
  domain?: string,
): boolean {
  return links.some((l) => {
    let u: URL;
    try {
      u = new URL(l);
    } catch {
      return false;
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const owner = u.pathname.split('/')[1]?.toLowerCase();
    if ((host === 'github.com' || host === 'gitlab.com') && owner === handle) {
      return true;
    }
    return !!domain && (host === domain || host.endsWith(`.${domain}`));
  });
}

export function mapNpmLatest(
  json: unknown,
  handle: string,
  domain?: string,
): FootprintNamesake | undefined {
  const o = obj(json);
  const name = str(o?.name, 214);
  if (!o || !name) return undefined;
  const links = [cleanLink(o.repository), cleanLink(o.homepage)].filter(
    (x): x is string => !!x,
  );
  return {
    name,
    url: `https://www.npmjs.com/package/${name}`,
    version: str(o.version, 50),
    description: str(o.description),
    links: [...new Set(links)],
    linkedToOrg: linksToOrg(links, handle, domain),
  };
}

export function mapPypi(
  json: unknown,
  handle: string,
  domain?: string,
): FootprintNamesake | undefined {
  const info = obj(obj(json)?.info);
  const name = str(info?.name, 200);
  if (!info || !name) return undefined;
  const urls = obj(info.project_urls) ?? {};
  const links = [info.home_page, ...Object.values(urls)]
    .map(cleanLink)
    .filter((x): x is string => !!x)
    .slice(0, 10);
  return {
    name,
    url: `https://pypi.org/project/${name}/`,
    version: str(info.version, 50),
    description: str(info.summary),
    links: [...new Set(links)],
    linkedToOrg: linksToOrg(links, handle, domain),
  };
}

// ------------------------------------------------------------ Docker Hub

export function mapDockerRepos(
  json: unknown,
  namespace: string,
): { items: FootprintItem[]; total: number } {
  const o = obj(json);
  const mapped = items(o?.results, (r) => {
    const name = str(r.name, 255);
    if (!name || r.is_private === true) return undefined;
    return {
      name,
      url: `https://hub.docker.com/r/${namespace}/${name}`,
      description: str(r.description),
      updatedAt: str(r.last_updated),
      pulls: num(r.pull_count),
      stars: num(r.star_count),
    };
  });
  return { items: mapped, total: Math.max(mapped.length, num(o?.count) ?? 0) };
}

// ------------------------------------------------------------ findings

const STALE_DAYS = 730;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const list = (names: string[], max = 10) =>
  names.length > max
    ? `${names.slice(0, max).join(', ')} (+${names.length - max} more)`
    : names.join(', ');

function stale(items: FootprintItem[], now: number) {
  return items.filter(
    (i) =>
      !i.archived &&
      i.updatedAt &&
      now - Date.parse(i.updatedAt) > STALE_DAYS * 86_400_000,
  );
}

export function footprintFindings(
  platforms: FootprintPlatformResult[],
  handle: string,
  now = Date.now(),
): Finding[] {
  const out: Finding[] = [];
  for (const p of platforms) {
    const label = FOOTPRINT_PLATFORM_LABELS[p.platform];
    if (p.status === 'error') continue;

    if (p.platform === 'github' || p.platform === 'gitlab') {
      const a = p.account;
      if (p.status === 'not-found' || !a) {
        out.push({
          id: `dev.${p.platform}.account`,
          status: 'info',
          title: `No ${label} organisation named "${handle}"`,
          message: `Nothing found at this handle. The organisation may use a different name on ${label}.`,
        });
      } else if (a.kind === 'user') {
        out.push({
          id: `dev.${p.platform}.account`,
          status: 'info',
          title: `"${handle}" is a personal ${label} account`,
          message:
            'Not inspected further: it may be unrelated to the organisation.',
          value: a.url,
        });
      } else {
        const count = a.publicRepos ?? p.totalItems ?? p.items.length;
        out.push({
          id: `dev.${p.platform}.account`,
          status: 'info',
          title: `${label} organisation found: ${count} public ${plural(count, 'repository', 'repositories')}`,
          message:
            'Review public repositories for secrets, internal hostnames and configuration.',
          value: a.url,
        });
        if (p.platform === 'github' && a.verified === false) {
          out.push({
            id: 'dev.github.verified',
            status: 'info',
            title: 'GitHub organisation has no verified domain',
            message:
              "Verifying the organisation's domain on GitHub shows users that the account is genuine.",
            value: a.url,
          });
        }
      }
    }

    if (
      p.platform === 'github' ||
      p.platform === 'gitlab' ||
      p.platform === 'dockerhub'
    ) {
      const old = stale(p.items, now);
      if (old.length) {
        out.push({
          id: `dev.${p.platform}.stale`,
          status: 'warn',
          title: `${old.length} ${label} ${
            p.platform === 'dockerhub'
              ? plural(old.length, 'image', 'images')
              : plural(old.length, 'repository', 'repositories')
          } untouched for 2+ years`,
          message:
            p.platform === 'dockerhub'
              ? 'Old public images keep accumulating known vulnerabilities; rebuild, deprecate or remove them.'
              : 'Abandoned public code still exposes history and dependencies; archive or remove what is no longer maintained.',
          value: list(old.map((i) => i.name)),
        });
      }
    }

    if (p.platform === 'dockerhub' && p.status === 'found') {
      out.push({
        id: 'dev.dockerhub.namespace',
        status: 'info',
        title: `Docker Hub namespace found: ${p.totalItems ?? p.items.length} public image(s)`,
        message:
          'Check public images for secrets in layers and outdated base images.',
        value: `https://hub.docker.com/u/${handle}`,
      });
    }

    if (p.platform === 'npm') {
      out.push(
        p.account
          ? {
              id: 'dev.npm.scope',
              status: 'info',
              title: `npm organisation @${handle} owns ${p.totalItems ?? p.items.length} package(s)`,
              message:
                'Published packages can leak source, endpoints and build details.',
              value: p.account.url,
            }
          : {
              id: 'dev.npm.scope',
              status: 'info',
              title: `npm scope @${handle} is unclaimed`,
              message: `Anyone can register it. If you use @${handle}/ for internal packages, claim the scope so builds cannot pull look-alike public packages.`,
            },
      );
    }

    if (p.platform === 'npm' || p.platform === 'pypi') {
      const n = p.namesake;
      const id = `dev.${p.platform}.namesake`;
      if (n === null) {
        out.push({
          id,
          status: 'info',
          title: `${label} package name "${handle}" is unregistered`,
          message:
            'Anyone can claim it. Consider registering it if your organisation uses that name internally.',
        });
      } else if (n) {
        out.push(
          n.ownedByOrg || n.linkedToOrg
            ? {
                id,
                status: 'pass',
                title: `${label} package "${n.name}" belongs to the organisation`,
                message: n.ownedByOrg
                  ? "It is owned by the organisation's npm org."
                  : 'Its repository or homepage points at the organisation.',
                value: n.url,
              }
            : {
                id,
                status: 'warn',
                title: `${label} package "${n.name}" is not linked to the organisation`,
                message:
                  'It may belong to someone else. If an internal package has the same name, builds could pull this public one (dependency confusion); verify ownership.',
                value: n.url,
              },
        );
      }
    }
  }
  return out;
}
