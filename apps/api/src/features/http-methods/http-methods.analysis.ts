import { isIP } from 'node:net';
import type { Finding, HstsInfo, HttpMethodsOutput } from '@recon/shared';

/** Methods a public website rarely needs; they widen the attack surface (WebDAV included). */
export const RISKY_METHODS = [
  'TRACE',
  'TRACK',
  'CONNECT',
  'PUT',
  'DELETE',
  'PATCH',
  'PROPFIND',
  'PROPPATCH',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
  'UNLOCK',
  'SEARCH',
];

/** HSTS max-age the preload list requires (one year). */
export const PRELOAD_MIN_AGE = 31_536_000;
/** Below this (180 days), HSTS protects returning visitors only briefly. */
export const HSTS_MIN_AGE = 15_552_000;

/** Allow header (or Access-Control-Allow-Methods) -> unique upper-case methods. */
export function parseAllow(
  ...headers: (string | null | undefined)[]
): string[] {
  const value = headers.find((h) => h?.trim());
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(',')
        .map((m) => m.trim().toUpperCase())
        .filter((m) => /^[A-Z-]{1,20}$/.test(m)),
    ),
  ];
}

export function riskyMethods(allowed: string[]): string[] {
  return allowed.filter((m) => RISKY_METHODS.includes(m));
}

export function parseHsts(header: string | null | undefined): HstsInfo {
  if (!header) return { includeSubDomains: false, preload: false };
  const parts = header
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const out: HstsInfo = { header, includeSubDomains: false, preload: false };
  for (const p of parts) {
    const [key = '', value] = p.split('=');
    const k = key.trim().toLowerCase();
    if (k === 'max-age') {
      const n = Number(value?.trim().replace(/^"|"$/g, ''));
      if (Number.isFinite(n)) out.maxAge = n;
    } else if (k === 'includesubdomains') out.includeSubDomains = true;
    else if (k === 'preload') out.preload = true;
  }
  return out;
}

/** True when a plain-HTTP response redirects to an https:// URL. */
export function isHttpsRedirect(
  status: number,
  location: string | null | undefined,
  base: string,
): boolean {
  if (status < 300 || status >= 400 || !location) return false;
  try {
    return new URL(location, base).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Host and its parent domains (down to two labels), the order hstspreload.org is asked. */
export function preloadCandidates(host: string): string[] {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (isIP(h.replace(/^\[|\]$/g, '')) || !h.includes('.')) return [];
  const labels = h.split('.');
  const out: string[] = [];
  for (let i = 0; labels.length - i >= 2 && out.length < 3; i++) {
    out.push(labels.slice(i).join('.'));
  }
  return out;
}

const VERSION_BANNER =
  /\b(Apache(?:-Coyote)?|nginx|openresty|Microsoft-IIS|LiteSpeed|lighttpd|Jetty|Caddy|Kestrel|Apache Tomcat|Werkzeug|gunicorn|PHP|Express)\/\d[\w.-]*/gi;

const BODY_LEAKS: [RegExp, string][] = [
  [/Traceback \(most recent call last\)/, 'Python traceback'],
  [/\bat [\w$.]+\([\w$]+\.java:\d+\)/, 'Java stack trace'],
  [/\bat .+\((?:node:internal|\/.+\.[cm]?js:\d+:\d+)\)/, 'Node.js stack trace'],
  [
    /Server Error in '.*' Application|System\.\w+Exception/,
    'ASP.NET error page',
  ],
  [/<b>(?:Warning|Fatal error|Parse error|Notice)<\/b>:/, 'PHP error message'],
  [/Whoops, looks like something went wrong|ignition-/i, 'Laravel debug page'],
  [
    /Django Version:|You're seeing this error because you have <code>DEBUG = True/,
    'Django debug page',
  ],
  [/Rails\.root:|Action Controller: Exception caught/, 'Rails debug page'],
  [/Werkzeug Debugger|The debugger caught an exception/, 'Werkzeug debugger'],
  [
    /SQLSTATE\[|You have an error in your SQL syntax|ORA-\d{5}/,
    'SQL error message',
  ],
];

/** Version banners and debug output in an error response (body and headers). */
export function findLeaks(
  body: string,
  headers: Record<string, string | undefined>,
): string[] {
  const leaks = new Set<string>();
  for (const [re, label] of BODY_LEAKS) if (re.test(body)) leaks.add(label);
  for (const m of body.matchAll(VERSION_BANNER))
    leaks.add(`Version in page: ${m[0]}`);
  const server = headers.server;
  if (server && /\d/.test(server)) leaks.add(`Server: ${server}`);
  for (const h of ['x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version']) {
    const v = headers[h];
    if (v) leaks.add(`${h}: ${v}`);
  }
  return [...leaks].slice(0, 20);
}

const DEFAULT_PAGES: [RegExp, string][] = [
  [/<title>Welcome to nginx!<\/title>/i, 'nginx welcome page'],
  [/<title>Welcome to OpenResty!<\/title>/i, 'OpenResty welcome page'],
  [/Apache2 (?:Ubuntu|Debian) Default Page/i, 'Apache default page'],
  [
    /Test Page for the (?:Apache|Nginx) HTTP Server|<title>HTTP Server Test Page/i,
    'Web server test page',
  ],
  [/<h1>It works!<\/h1>/i, 'Apache "It works!" page'],
  [/<title>IIS Windows Server<\/title>|iisstart\.png/i, 'IIS default page'],
  [/you've successfully installed Tomcat/i, 'Tomcat default page'],
  [/Caddy works!|<title>Caddy Default Page/i, 'Caddy default page'],
];

export function detectDefaultPage(body: string): string | undefined {
  return DEFAULT_PAGES.find(([re]) => re.test(body))?.[1];
}

type Probes = Omit<HttpMethodsOutput, 'findings'>;

export function methodsFindings(o: Probes): Finding[] {
  const out: Finding[] = [];
  const https = o.url.startsWith('https:');

  // Allowed methods
  if (o.options.error || !o.options.allowed.length) {
    out.push({
      id: 'methods.allowed',
      status: 'info',
      title: 'Allowed methods',
      message: o.options.error
        ? `OPTIONS request failed: ${o.options.error}`
        : 'The server does not advertise its methods (no Allow header on OPTIONS).',
    });
  } else if (o.options.risky.length) {
    out.push({
      id: 'methods.allowed',
      status: 'warn',
      title: 'Risky methods advertised',
      message:
        'OPTIONS lists methods a website rarely needs. Check whether they really work (and need to) on this URL; WebDAV methods hint at a writable share.',
      value: o.options.risky.join(', '),
    });
  } else {
    out.push({
      id: 'methods.allowed',
      status: 'pass',
      title: 'Allowed methods',
      message: 'Only common read methods are advertised.',
      value: o.options.allowed.join(', '),
    });
  }

  // TRACE
  if (o.trace.reflected) {
    out.push({
      id: 'methods.trace',
      status: 'fail',
      title: 'TRACE enabled',
      message:
        'The server echoes TRACE requests, headers included (Cross-Site Tracing). Disable TRACE.',
    });
  } else if (o.trace.error) {
    out.push({
      id: 'methods.trace',
      status: 'info',
      title: 'TRACE',
      message: `TRACE request failed: ${o.trace.error}`,
    });
  } else {
    out.push({
      id: 'methods.trace',
      status: 'pass',
      title: 'TRACE disabled',
      message: `TRACE is not echoed (status ${o.trace.status ?? '-'}).`,
    });
  }

  // HTTP -> HTTPS
  const r = o.httpsRedirect;
  if (r.redirectsToHttps) {
    out.push({
      id: 'https.redirect',
      status: 'pass',
      title: 'HTTP redirects to HTTPS',
      message: `${r.url} answers ${r.status} to ${r.location}.`,
    });
  } else if (r.error) {
    out.push({
      id: 'https.redirect',
      status: 'info',
      title: 'No plain-HTTP listener',
      message: `${r.url} is not reachable (${r.error}), so there is nothing to downgrade to.`,
    });
  } else if (r.status !== undefined && r.status >= 300 && r.status < 400) {
    out.push({
      id: 'https.redirect',
      status: 'warn',
      title: 'HTTP redirect stays on HTTP',
      message: `${r.url} redirects to ${r.location ?? '(no location)'} instead of an https:// URL.`,
    });
  } else {
    out.push({
      id: 'https.redirect',
      status: 'fail',
      title: 'Served over plain HTTP',
      message: `${r.url} answers ${r.status ?? '?'} without redirecting to HTTPS: visitors who type the bare name can be intercepted.`,
    });
  }

  // HSTS
  if (!https) {
    out.push({
      id: 'hsts.header',
      status: 'fail',
      title: 'No HTTPS',
      message: 'The tested URL ends on plain HTTP, so HSTS cannot apply.',
    });
  } else if (!o.hsts.header) {
    out.push({
      id: 'hsts.header',
      status: 'fail',
      title: 'HSTS missing',
      message:
        'No Strict-Transport-Security header: browsers will still try plain HTTP first.',
    });
  } else if ((o.hsts.maxAge ?? 0) < HSTS_MIN_AGE) {
    out.push({
      id: 'hsts.header',
      status: 'warn',
      title: 'HSTS max-age short',
      message: 'max-age is below 180 days; one year (31536000) is recommended.',
      value: o.hsts.header,
    });
  } else {
    out.push({
      id: 'hsts.header',
      status: 'pass',
      title: 'HSTS enabled',
      message: `max-age ${o.hsts.maxAge} s${o.hsts.includeSubDomains ? ', includeSubDomains' : ''}.`,
      value: o.hsts.header,
    });
  }

  if (https && o.hsts.header) {
    const missing = [
      (o.hsts.maxAge ?? 0) < PRELOAD_MIN_AGE && 'max-age >= 31536000',
      !o.hsts.includeSubDomains && 'includeSubDomains',
      !o.hsts.preload && 'preload',
      !r.redirectsToHttps && !r.error && 'HTTP -> HTTPS redirect',
    ].filter((m): m is string => !!m);
    out.push({
      id: 'hsts.preload-ready',
      status: missing.length ? 'info' : 'pass',
      title: 'HSTS preload requirements',
      message: missing.length
        ? `Missing for the preload list: ${missing.join(', ')}.`
        : 'Meets the header requirements of hstspreload.org.',
    });
  }

  const list = o.hsts.preloadList;
  if (list) {
    const preloaded = list.status === 'preloaded';
    out.push({
      id: 'hsts.preload-list',
      status: preloaded ? 'pass' : 'info',
      title: preloaded
        ? 'On the HSTS preload list'
        : 'Not on the HSTS preload list',
      message: preloaded
        ? `${list.domain} is preloaded${list.includeSubDomains ? ' with subdomains' : ''}: browsers never use plain HTTP for it.`
        : `hstspreload.org reports "${list.status}" for ${list.domain}.`,
    });
  }

  // Error page and default page
  const e = o.errorPage;
  if (e.leaks.length) {
    out.push({
      id: 'errors.leaks',
      status: 'warn',
      title: 'Error page leaks details',
      message:
        'The 404 response reveals versions or debug output that help attackers pick exploits.',
      value: e.leaks.join('; '),
    });
  } else if (!e.error) {
    out.push({
      id: 'errors.leaks',
      status: 'pass',
      title: 'Error page',
      message: 'No version banners or stack traces in the error response.',
    });
  }
  if (e.soft404) {
    out.push({
      id: 'errors.soft404',
      status: 'info',
      title: 'Soft 404',
      message:
        'A random path answers 200, so path-based scanners will report false positives here.',
    });
  }
  if (o.defaultPage) {
    out.push({
      id: 'default.page',
      status: 'warn',
      title: 'Default install page',
      message: `The site shows the ${o.defaultPage}: an unconfigured or forgotten server.`,
    });
  }
  return out;
}
