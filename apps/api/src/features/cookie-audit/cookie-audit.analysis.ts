import {
  gradeFindings,
  type AuditedCookie,
  type CookieCheck,
  type Finding,
  type Grade,
} from '@recon/shared';

/** Set-Cookie attributes as parsed; the value itself is reduced to its length. */
export interface ParsedCookie {
  name: string;
  valueLength: number;
  domain?: string;
  path?: string;
  maxAgeSeconds?: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: string;
  partitioned: boolean;
}

/** Names that usually carry a session or credential. CSRF tokens are meant to be read by JS. */
const SENSITIVE =
  /(sess|sid\b|auth|token|jwt|login|remember|identity|credential|access|refresh)/i;
const NOT_SENSITIVE =
  /(csrf|xsrf|consent|cookie_?policy|gdpr|lang|locale|theme)/i;

/** Persistent session cookies living longer than this get a warning. */
const LONG_LIFETIME_SECONDS = 30 * 24 * 3600;

export function isSensitiveName(name: string): boolean {
  return SENSITIVE.test(name) && !NOT_SENSITIVE.test(name);
}

/**
 * Parses one Set-Cookie header (RFC 6265 section 5.2). Returns null for headers browsers
 * ignore (no `=` in the name-value pair, empty name). `now` resolves Expires to a lifetime.
 */
export function parseSetCookie(
  header: string,
  now: Date = new Date(),
): ParsedCookie | null {
  const [pair = '', ...attrs] = header.split(';');
  const eq = pair.indexOf('=');
  if (eq < 0) return null;
  const name = pair.slice(0, eq).trim();
  if (!name) return null;
  const out: ParsedCookie = {
    name,
    valueLength: pair.slice(eq + 1).trim().length,
    secure: false,
    httpOnly: false,
    partitioned: false,
  };
  let expires: number | undefined;
  let maxAge: number | undefined;
  for (const raw of attrs) {
    const i = raw.indexOf('=');
    const key = (i < 0 ? raw : raw.slice(0, i)).trim().toLowerCase();
    const value = i < 0 ? '' : raw.slice(i + 1).trim();
    switch (key) {
      case 'secure':
        out.secure = true;
        break;
      case 'httponly':
        out.httpOnly = true;
        break;
      case 'partitioned':
        out.partitioned = true;
        break;
      case 'samesite':
        if (value) out.sameSite = value;
        break;
      case 'domain':
        if (value) out.domain = value.replace(/^\./, '').toLowerCase();
        break;
      case 'path':
        if (value) out.path = value;
        break;
      case 'max-age':
        if (/^-?\d+$/.test(value)) maxAge = Number(value);
        break;
      case 'expires': {
        const t = Date.parse(value);
        if (!Number.isNaN(t)) expires = Math.round((t - now.getTime()) / 1000);
        break;
      }
    }
  }
  // Max-Age wins over Expires.
  const lifetime = maxAge ?? expires;
  if (lifetime !== undefined) out.maxAgeSeconds = lifetime;
  return out;
}

interface Context {
  /** Hostname of the response that set the cookie. */
  host: string;
  /** That response came over HTTPS. */
  https: boolean;
}

/** Grades one cookie; every check returns one status. */
export function auditCookie(
  c: ParsedCookie,
  setBy: string,
  ctx: Context,
): AuditedCookie {
  const sensitive = isSensitiveName(c.name);
  const prefix = c.name.startsWith('__Host-')
    ? '__Host-'
    : c.name.startsWith('__Secure-')
      ? '__Secure-'
      : undefined;
  const checks: CookieCheck[] = [
    secureCheck(c, ctx, sensitive),
    httpOnlyCheck(c, sensitive),
    sameSiteCheck(c, sensitive),
    prefixCheck(c, prefix, sensitive),
    domainCheck(c, ctx, sensitive),
    lifetimeCheck(c, sensitive),
  ];
  return {
    name: c.name,
    valueLength: c.valueLength,
    setBy,
    ...(c.domain && { domain: c.domain }),
    ...(c.path && { path: c.path }),
    ...(c.maxAgeSeconds !== undefined && { maxAgeSeconds: c.maxAgeSeconds }),
    secure: c.secure,
    httpOnly: c.httpOnly,
    ...(c.sameSite && { sameSite: c.sameSite }),
    partitioned: c.partitioned,
    ...(prefix && { prefix }),
    sensitive,
    checks,
  };
}

function secureCheck(
  c: ParsedCookie,
  ctx: Context,
  sensitive: boolean,
): CookieCheck {
  if (c.secure)
    return { id: 'secure', status: 'pass', message: 'Only sent over HTTPS.' };
  if (!ctx.https) {
    return {
      id: 'secure',
      status: sensitive ? 'fail' : 'warn',
      message:
        'Set over plain HTTP without Secure: readable by anyone on the network path.',
    };
  }
  return {
    id: 'secure',
    status: sensitive ? 'fail' : 'warn',
    message:
      'Missing Secure: the browser also sends it over plain HTTP, where it can be intercepted.',
  };
}

function httpOnlyCheck(c: ParsedCookie, sensitive: boolean): CookieCheck {
  if (c.httpOnly)
    return {
      id: 'httponly',
      status: 'pass',
      message: 'Not readable by JavaScript.',
    };
  return sensitive
    ? {
        id: 'httponly',
        status: 'fail',
        message:
          'Looks like a session cookie but lacks HttpOnly: an XSS bug could steal it.',
      }
    : {
        id: 'httponly',
        status: 'info',
        message:
          'Readable by JavaScript (fine for preferences or CSRF tokens, not for sessions).',
      };
}

function sameSiteCheck(c: ParsedCookie, sensitive: boolean): CookieCheck {
  const v = c.sameSite?.toLowerCase();
  if (v === 'strict' || v === 'lax') {
    return {
      id: 'samesite',
      status: 'pass',
      message: `SameSite=${c.sameSite}: not sent on most cross-site requests.`,
    };
  }
  if (v === 'none') {
    if (!c.secure) {
      return {
        id: 'samesite',
        status: 'fail',
        message:
          'SameSite=None without Secure: modern browsers reject the cookie.',
      };
    }
    return {
      id: 'samesite',
      status: sensitive ? 'warn' : 'info',
      message:
        'SameSite=None: sent on cross-site requests (needed for embeds, but enables CSRF).',
    };
  }
  if (v !== undefined) {
    return {
      id: 'samesite',
      status: 'warn',
      message: `Unknown SameSite value "${c.sameSite}": browsers treat it as Lax.`,
    };
  }
  return {
    id: 'samesite',
    status: 'warn',
    message:
      'No SameSite attribute: browsers default to Lax, but older ones send it everywhere. Set it explicitly.',
  };
}

function prefixCheck(
  c: ParsedCookie,
  prefix: AuditedCookie['prefix'],
  sensitive: boolean,
): CookieCheck {
  if (prefix === '__Host-') {
    const ok = c.secure && !c.domain && c.path === '/';
    return ok
      ? {
          id: 'prefix',
          status: 'pass',
          message: '__Host- prefix: locked to this host, HTTPS and path /.',
        }
      : {
          id: 'prefix',
          status: 'fail',
          message:
            '__Host- cookies need Secure, Path=/ and no Domain; browsers reject this one.',
        };
  }
  if (prefix === '__Secure-') {
    return c.secure
      ? {
          id: 'prefix',
          status: 'pass',
          message: '__Secure- prefix: browsers enforce the Secure flag.',
        }
      : {
          id: 'prefix',
          status: 'fail',
          message: '__Secure- cookies need Secure; browsers reject this one.',
        };
  }
  return {
    id: 'prefix',
    status: 'info',
    message: sensitive
      ? 'No __Host- prefix: subdomains or plain-HTTP pages could overwrite this session cookie.'
      : 'No cookie prefix.',
  };
}

function domainCheck(
  c: ParsedCookie,
  ctx: Context,
  sensitive: boolean,
): CookieCheck {
  if (!c.domain) {
    return {
      id: 'domain',
      status: 'pass',
      message: 'Host-only: not sent to other subdomains.',
    };
  }
  const host = ctx.host.toLowerCase();
  if (c.domain === host) {
    return {
      id: 'domain',
      status: 'info',
      message: `Domain=${c.domain}: also sent to every subdomain of ${c.domain}.`,
    };
  }
  return {
    id: 'domain',
    status: sensitive ? 'warn' : 'info',
    message: `Domain=${c.domain}: shared with every host under ${c.domain}, so any of them can read it.`,
  };
}

function lifetimeCheck(c: ParsedCookie, sensitive: boolean): CookieCheck {
  if (c.maxAgeSeconds === undefined) {
    return {
      id: 'lifetime',
      status: 'pass',
      message: 'Session cookie: removed when the browser closes.',
    };
  }
  if (c.maxAgeSeconds <= 0) {
    return {
      id: 'lifetime',
      status: 'info',
      message: 'Already expired: this response deletes the cookie.',
    };
  }
  const days = Math.round(c.maxAgeSeconds / 86400);
  if (sensitive && c.maxAgeSeconds > LONG_LIFETIME_SECONDS) {
    return {
      id: 'lifetime',
      status: 'warn',
      message: `Session-like cookie kept for ${days} days: a stolen copy stays valid for long.`,
    };
  }
  return {
    id: 'lifetime',
    status: 'info',
    message:
      days >= 1
        ? `Persistent for ${days} day${days === 1 ? '' : 's'}.`
        : 'Persistent for less than a day.',
  };
}

/** Keeps the last cookie per name + domain + path (later Set-Cookie headers overwrite). */
export function dedupeCookies<
  T extends { name: string; domain?: string; path?: string },
>(cookies: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const c of cookies) {
    const key = `${c.name}\u0000${c.domain ?? ''}\u0000${c.path ?? ''}`;
    byKey.delete(key);
    byKey.set(key, c);
  }
  return [...byKey.values()];
}

/** One finding per cookie and check, plus a grade (null when there is nothing to grade). */
export function cookieFindings(cookies: AuditedCookie[]): {
  findings: Finding[];
  grade: Grade | null;
  score: number | null;
} {
  if (!cookies.length) {
    return {
      findings: [
        {
          id: 'cookies.none',
          status: 'info',
          title: 'No cookies set',
          message: 'The responses in the redirect chain set no cookies.',
        },
      ],
      grade: null,
      score: null,
    };
  }
  const findings: Finding[] = cookies.flatMap((c) =>
    c.checks.map((check) => ({
      id: `cookie.${c.name}.${check.id}`,
      status: check.status,
      title: `${c.name}: ${CHECK_LABEL[check.id]}`,
      message: check.message,
    })),
  );
  const report = gradeFindings(findings);
  return { findings, grade: report.grade, score: report.score };
}

const CHECK_LABEL: Record<CookieCheck['id'], string> = {
  secure: 'Secure',
  httponly: 'HttpOnly',
  samesite: 'SameSite',
  prefix: 'Prefix',
  domain: 'Domain scope',
  lifetime: 'Lifetime',
};
