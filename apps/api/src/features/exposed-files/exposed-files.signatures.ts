import type { ExposedFileCheck, Finding } from '@recon/shared';

const MAX_EVIDENCE = 200;

export interface SignatureMatch {
  exposed: boolean;
  /** Sanitised, masked excerpt (only when exposed). */
  evidence?: string;
}

export const looksLikeHtml = (text: string) =>
  /^\s*(<!doctype html|<html|<head|<body)/i.test(text) ||
  /<html[\s>]|<body[\s>]/i.test(text.slice(0, 4096));

const SECRET_KEY =
  '(?:pass(?:word|wd)?|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|credentials?|auth[_-]?key|salt|connection[_-]?string)';

/** Masks values that look like credentials: key=value, key: value, key="value", URL userinfo. */
export function maskSecrets(text: string): string {
  return (
    text
      // https://user:pass@host -> https://****@host
      .replace(/(\/\/)[^/\s@:]+:[^/\s@]+@/g, '$1****@')
      // XML/HTML attributes: password="..."
      .replace(
        new RegExp(
          `(\\b[\\w.-]*${SECRET_KEY}[\\w.-]*\\s*=\\s*)(["'])[^"']*\\2`,
          'gi',
        ),
        '$1$2****$2',
      )
      // PHP define('DB_PASSWORD', '...')
      .replace(
        /(define\(\s*(['"])[A-Z0-9_]+\2\s*,\s*)(['"])[^'"]*\3/gi,
        '$1$3****$3',
      )
      // "password": "..." in JSON
      .replace(
        new RegExp(`("[\\w.-]*${SECRET_KEY}[\\w.-]*"\\s*:\\s*)"[^"]*"`, 'gi'),
        '$1"****"',
      )
      // key = value / key: value (unquoted)
      .replace(
        new RegExp(
          `(\\b[\\w.-]*${SECRET_KEY}[\\w.-]*\\s*[:=]\\s*)(?!\\*\\*\\*\\*|["'])[^\\s;,&]+`,
          'gi',
        ),
        '$1****',
      )
  );
}

/** Removes control characters, collapses whitespace and caps the length. */
export function sanitiseEvidence(text: string): string {
  // Control characters (incl. NUL in binary files) become spaces.
  const clean = text
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > MAX_EVIDENCE
    ? `${clean.slice(0, MAX_EVIDENCE - 1)}…`
    : clean;
}

const stripTags = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

function parseJson(text: string): Record<string, unknown> | undefined {
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** .env: keys only, every value replaced. */
function envEvidence(text: string): string | undefined {
  const keys: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=/.exec(line);
    if (m) keys.push(`${m[1]}=****`);
  }
  return keys.length >= 2 ? keys.join(' ') : undefined;
}

type Matcher = (text: string) => string | undefined;

/** Per-path content signatures. Return the raw evidence (masked later) or undefined. */
const MATCHERS: Record<string, Matcher> = {
  '/.git/HEAD': (t) => {
    const first = t.trimStart().split(/\r?\n/)[0] ?? '';
    return /^ref: refs\/\S+$/.test(first.trim()) ||
      /^[0-9a-f]{40}$/i.test(first.trim())
      ? first
      : undefined;
  },
  '/.git/config': (t) =>
    /^\s*\[core\]/m.test(t) && !looksLikeHtml(t) ? t : undefined,
  '/.svn/entries': (t) =>
    /<wc-entries/i.test(t) || (/^\d+\s*(\r?\n|$)/.test(t) && !looksLikeHtml(t))
      ? t
      : undefined,
  '/.hg/requires': (t) =>
    !looksLikeHtml(t) && /^(revlogv1|store)\s*$/m.test(t) ? t : undefined,
  '/.env': (t) => (looksLikeHtml(t) ? undefined : envEvidence(t)),
  '/.DS_Store': (t) =>
    t.startsWith('\0\0\0\u0001Bud1')
      ? 'Bud1 header (macOS .DS_Store)'
      : undefined,
  '/server-status': (t) => {
    if (!/Apache Server Status/i.test(t)) return undefined;
    const version = /Server Version:\s*([^<\n]+)/i.exec(t)?.[1];
    return version
      ? `Apache Server Status, Server Version: ${version}`
      : 'Apache Server Status';
  },
  '/server-info': (t) => {
    if (!/Apache Server Information/i.test(t)) return undefined;
    const version = /Server Version:\s*(?:<[^>]*>\s*)*([^<\n]+)/i.exec(t)?.[1];
    return version
      ? `Apache Server Information, Server Version: ${version}`
      : 'Apache Server Information';
  },
  '/phpinfo.php': (t) => {
    const plain = stripTags(t);
    const version = /PHP Version\s*([\d.]+)/i.exec(plain)?.[1];
    if (version) return `PHP Version ${version}`;
    return /phpinfo\(\)/.test(t) ? 'phpinfo()' : undefined;
  },
  '/actuator': (t) => {
    const json = parseJson(t);
    const links = json?._links;
    if (!links || typeof links !== 'object') return undefined;
    return `_links: ${Object.keys(links).slice(0, 20).join(', ')}`;
  },
  '/actuator/env': (t) => {
    const json = parseJson(t);
    if (!json || !('propertySources' in json || 'activeProfiles' in json))
      return undefined;
    const profiles = Array.isArray(json.activeProfiles)
      ? json.activeProfiles.filter((p) => typeof p === 'string').join(', ')
      : '';
    const sources = Array.isArray(json.propertySources)
      ? json.propertySources.length
      : 0;
    return `activeProfiles: [${profiles}], propertySources: ${sources} (values not shown)`;
  },
  '/.well-known/openid-configuration': (t) => {
    const issuer = str(parseJson(t)?.issuer);
    return issuer ? `issuer: ${issuer}` : undefined;
  },
  '/swagger.json': apiSpec,
  '/openapi.json': apiSpec,
  '/crossdomain.xml': (t) => {
    if (!/<cross-domain-policy/i.test(t)) return undefined;
    const domains = [
      ...t.matchAll(/allow-access-from[^>]*domain\s*=\s*["']([^"']+)["']/gi),
    ]
      .map((m) => m[1])
      .slice(0, 10);
    return domains.length
      ? `allow-access-from: ${domains.join(', ')}`
      : '<cross-domain-policy>';
  },
  '/.htaccess': (t) =>
    !looksLikeHtml(t) &&
    /^\s*(RewriteEngine|RewriteRule|RewriteCond|Deny from|Allow from|Require|AuthType|AuthUserFile|Order\s+(allow|deny))\b/im.test(
      t,
    )
      ? t
          .split(/\r?\n/)
          .filter((l) => l.trim() && !l.trim().startsWith('#'))
          .slice(0, 6)
          .join(' | ')
      : undefined,
  '/web.config': (t) =>
    /<configuration[\s>]/i.test(t) && !/<html[\s>]/i.test(t)
      ? (/<configuration[\s\S]*/i.exec(t)?.[0] ?? t)
      : undefined,
  '/wp-config.php.bak': (t) => {
    if (!/DB_PASSWORD|define\s*\(/.test(t)) return undefined;
    const defines = [
      ...t.matchAll(
        /define\s*\(\s*['"][A-Z0-9_]+['"]\s*,\s*['"][^'"]*['"]\s*\)/g,
      ),
    ]
      .map((m) => m[0])
      .slice(0, 4);
    return defines.length ? defines.join(' ') : 'DB_PASSWORD / define() found';
  },
};

function apiSpec(t: string): string | undefined {
  const json = parseJson(t);
  if (!json) return undefined;
  const version = str(json.openapi) ?? str(json.swagger);
  if (!version) return undefined;
  const info = json.info as Record<string, unknown> | undefined;
  const title = str(info?.title);
  const paths =
    json.paths && typeof json.paths === 'object'
      ? Object.keys(json.paths).length
      : 0;
  return `${'openapi' in json ? 'OpenAPI' : 'Swagger'} ${version}${title ? `: ${title}` : ''}, ${paths} paths`;
}

/** Checks a 200 response body against the expected signature of `path`. */
export function matchSignature(path: string, text: string): SignatureMatch {
  const matcher = MATCHERS[path];
  const raw = matcher?.(text);
  if (raw === undefined) return { exposed: false };
  return { exposed: true, evidence: sanitiseEvidence(maskSecrets(raw)) };
}

const SEVERITY_STATUS = {
  high: 'fail',
  medium: 'fail',
  low: 'warn',
  info: 'info',
} as const;

export function exposedFindings(checks: ExposedFileCheck[]): Finding[] {
  const exposed = checks.filter((c) => c.exposed);
  if (!exposed.length) {
    return [
      {
        id: 'exposed-files.none',
        status: 'pass',
        title: 'No exposed files',
        message: `None of the ${checks.length} well-known sensitive paths is publicly readable.`,
      },
    ];
  }
  return exposed.map((c) => ({
    id: `exposed-files.${slug(c.path)}`,
    status: SEVERITY_STATUS[c.severity],
    title: c.title,
    message: `${c.url} is publicly readable (${c.severity} severity).`,
    value: c.evidence,
  }));
}

const slug = (path: string) =>
  path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
