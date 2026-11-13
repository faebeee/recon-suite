import type { Finding, JsEndpoint, JsScript, JsSecret } from '@recon/shared';

export const MAX_ENDPOINTS = 500;
export const MAX_HOSTS = 200;
const MAX_SOURCES = 3;
const MAX_SCRIPT_REFS = 100;
const MAX_INLINE = 50;
const MAX_PATH_LENGTH = 200;

export interface PageScripts {
  /** Absolute http(s) URLs of external scripts and module preloads, deduped, in page order. */
  urls: string[];
  /** Bodies of inline scripts (JavaScript only). */
  inline: string[];
}

const attr = (tag: string, name: string) =>
  new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i')
    .exec(tag)
    ?.slice(1)
    .find((v) => v !== undefined);

function resolveHttp(ref: string, base: string): string | undefined {
  try {
    const u = new URL(ref.trim(), base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    u.hash = '';
    return u.href;
  } catch {
    return undefined;
  }
}

/** Extracts `<script src>`, `<link rel="modulepreload">` and inline script bodies. */
export function extractPageScripts(html: string, baseUrl: string): PageScripts {
  const urls = new Set<string>();
  const inline: string[] = [];

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = m[1] ?? '';
    const src = attr(attrs, 'src');
    if (src !== undefined) {
      const url = resolveHttp(src, baseUrl);
      if (url && urls.size < MAX_SCRIPT_REFS) urls.add(url);
      continue;
    }
    const type = attr(attrs, 'type')?.toLowerCase();
    const isJs = !type || type === 'module' || /(java|ecma)script/.test(type);
    const body = m[2]?.trim();
    if (isJs && body && inline.length < MAX_INLINE) inline.push(body);
  }

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = attr(tag, 'rel')?.toLowerCase().split(/\s+/) ?? [];
    const href = attr(tag, 'href');
    if (!rel.includes('modulepreload') || href === undefined) continue;
    const url = resolveHttp(href, baseUrl);
    if (url && urls.size < MAX_SCRIPT_REFS) urls.add(url);
  }
  return { urls: [...urls], inline };
}

/** Same host, or a subdomain of the page host (with a leading `www.` stripped). */
export function isSameSite(url: string, pageHost: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const page = pageHost.toLowerCase();
  const base = page.replace(/^www\./, '');
  return host === page || host === base || host.endsWith(`.${base}`);
}

const STATIC_ASSET =
  /\.(png|jpe?g|svg|gif|webp|ico|woff2?|ttf|eot|otf|css)(?:[?#]|$)/i;
const PATH_CHARS = /^\/[\w\-./~%:@!$&'()*+,;=?#[\]{}]+$/;
const STRING_LITERAL =
  /'((?:[^'\\\n]|\\.){1,2000})'|"((?:[^"\\\n]|\\.){1,2000})"|`((?:[^`\\]|\\.){1,2000})`/g;

const unescape = (s: string) =>
  s.replace(/\\u002[fF]/g, '/').replace(/\\(.)/g, '$1');

export interface ExtractedEndpoint {
  value: string;
  kind: JsEndpoint['kind'];
}

/** Classifies one string literal value as endpoint (or not). */
export function classifyLiteral(raw: string): ExtractedEndpoint | undefined {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) {
    if (/\s/.test(value) || value.length > 2000) return undefined;
    try {
      const u = new URL(value);
      if (!u.hostname.includes('.') && u.hostname !== 'localhost')
        return undefined;
    } catch {
      return undefined;
    }
    return { value, kind: 'url' };
  }
  if (
    value.length >= 3 &&
    value.length <= MAX_PATH_LENGTH &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    /[a-z]/i.test(value) &&
    PATH_CHARS.test(value) &&
    !STATIC_ASSET.test(value)
  ) {
    return { value, kind: 'path' };
  }
  return undefined;
}

/** Absolute URLs and endpoint-like root-relative paths found in string literals. */
export function extractEndpoints(code: string): ExtractedEndpoint[] {
  const out = new Map<string, ExtractedEndpoint>();
  for (const m of code.matchAll(STRING_LITERAL)) {
    const literal = m[1] ?? m[2] ?? m[3];
    if (literal === undefined) continue;
    // Template literals with interpolation are not a fixed endpoint.
    if (m[3] !== undefined && literal.includes('${')) continue;
    const hit = classifyLiteral(unescape(literal));
    if (hit && !out.has(hit.value)) out.set(hit.value, hit);
  }
  return [...out.values()];
}

const SECRET_PATTERNS: {
  type: string;
  re: RegExp;
  severity: 'fail' | 'warn';
}[] = [
  { type: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'fail' },
  { type: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}/g, severity: 'warn' },
  {
    type: 'Stripe live secret key',
    re: /\bsk_live_[0-9a-zA-Z]{24,}/g,
    severity: 'fail',
  },
  {
    type: 'Slack token',
    re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/g,
    severity: 'fail',
  },
  {
    type: 'GitHub token',
    re: /\bgh[pousr]_[A-Za-z0-9]{36}\b/g,
    severity: 'fail',
  },
  { type: 'JWT', re: /\beyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g, severity: 'warn' },
  {
    type: 'private key',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g,
    severity: 'fail',
  },
];

export const SECRET_SEVERITY: Record<string, 'fail' | 'warn'> =
  Object.fromEntries(SECRET_PATTERNS.map((p) => [p.type, p.severity]));

export const maskSecret = (s: string) =>
  s.length <= 8 ? '****' : `${s.slice(0, 4)}…${s.slice(-4)}`;

/** Secrets in `code`, masked and deduped. */
export function extractSecrets(code: string, source: string): JsSecret[] {
  const seen = new Set<string>();
  const out: JsSecret[] = [];
  for (const { type, re } of SECRET_PATTERNS) {
    for (const m of code.matchAll(re)) {
      const key = `${type}\0${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type, masked: maskSecret(m[0]), source });
    }
  }
  return out;
}

/** The (last) `sourceMappingURL` of a script, resolved against the script URL. */
export function findSourceMap(
  code: string,
  scriptUrl: string,
): string | undefined {
  const matches = [
    ...code.matchAll(/\/[/*][#@]\s*sourceMappingURL\s*=\s*([^\s*'"]+)/g),
  ];
  const ref = matches.at(-1)?.[1];
  if (!ref || /^data:/i.test(ref)) return undefined;
  return resolveHttp(ref, scriptUrl);
}

export interface AnalysedSource {
  source: string;
  endpoints: ExtractedEndpoint[];
  secrets: JsSecret[];
}

export function analyseSource(code: string, source: string): AnalysedSource {
  return {
    source,
    endpoints: extractEndpoints(code),
    secrets: extractSecrets(code, source),
  };
}

/** Merges per-source results: dedupe, cap and keep up to 3 sources per endpoint. */
export function mergeResults(results: AnalysedSource[]): {
  endpoints: JsEndpoint[];
  hosts: string[];
  secrets: JsSecret[];
} {
  const endpoints = new Map<string, JsEndpoint>();
  const hosts = new Set<string>();
  const secrets = new Map<string, JsSecret>();
  for (const r of results) {
    for (const e of r.endpoints) {
      if (e.kind === 'url' && hosts.size < MAX_HOSTS) {
        try {
          hosts.add(new URL(e.value).hostname.toLowerCase());
        } catch {
          // classifyLiteral only returns parseable URLs
        }
      }
      const existing = endpoints.get(e.value);
      if (existing) {
        if (
          existing.sources.length < MAX_SOURCES &&
          !existing.sources.includes(r.source)
        )
          existing.sources.push(r.source);
      } else if (endpoints.size < MAX_ENDPOINTS) {
        endpoints.set(e.value, {
          value: e.value,
          kind: e.kind,
          sources: [r.source],
        });
      }
    }
    for (const s of r.secrets) {
      const key = `${s.type}\0${s.masked}`;
      if (!secrets.has(key)) secrets.set(key, s);
    }
  }
  return {
    endpoints: [...endpoints.values()],
    hosts: [...hosts].sort(),
    secrets: [...secrets.values()],
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function jsFindings(
  scripts: JsScript[],
  endpoints: JsEndpoint[],
  secrets: JsSecret[],
): Finding[] {
  const findings: Finding[] = [];
  const byType = new Map<string, JsSecret[]>();
  for (const s of secrets)
    byType.set(s.type, [...(byType.get(s.type) ?? []), s]);
  for (const [type, list] of byType) {
    const status = SECRET_SEVERITY[type] ?? 'warn';
    findings.push({
      id: `js.secret.${slug(type)}`,
      status,
      title: `${type} in JavaScript`,
      message:
        status === 'fail'
          ? `${list.length} ${type} value(s) are hard-coded in client-side code. Revoke and rotate them.`
          : `${list.length} ${type} value(s) found in client-side code. Check that they are meant to be public and restricted.`,
      value: list.map((s) => s.masked).join(', '),
    });
  }
  if (!secrets.length) {
    findings.push({
      id: 'js.secrets',
      status: 'pass',
      title: 'Secrets',
      message: 'No known secret patterns found in the analysed scripts.',
    });
  }
  const maps = scripts.filter((s) => s.sourceMapExposed);
  if (maps.length) {
    findings.push({
      id: 'js.sourcemaps',
      status: 'warn',
      title: 'Source maps exposed',
      message: `${maps.length} source map(s) are downloadable and reveal the original source code.`,
      value: maps.map((s) => s.sourceMap).join(', '),
    });
  }
  findings.push({
    id: 'js.endpoints',
    status: 'info',
    title: 'Endpoints',
    message: `${endpoints.length} endpoint(s) referenced in ${scripts.filter((s) => s.bytes !== undefined).length} downloaded script(s) and inline code.`,
  });
  return findings;
}
