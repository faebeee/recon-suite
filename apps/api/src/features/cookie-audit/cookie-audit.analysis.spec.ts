import {
  auditCookie,
  cookieFindings,
  dedupeCookies,
  isSensitiveName,
  parseSetCookie,
} from './cookie-audit.analysis.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const https = { host: 'www.example.com', https: true };
const check = (header: string, ctx = https) => {
  const parsed = parseSetCookie(header, NOW);
  if (!parsed) throw new Error('not parsed');
  const c = auditCookie(parsed, 'https://www.example.com/', ctx);
  return Object.fromEntries(c.checks.map((x) => [x.id, x.status]));
};

describe('parseSetCookie', () => {
  it('parses attributes case-insensitively and keeps only the value length', () => {
    const c = parseSetCookie(
      'SID=abc123; Path=/; DOMAIN=.Example.com; secure; HttpOnly; SameSite=Lax; Partitioned',
      NOW,
    );
    expect(c).toEqual({
      name: 'SID',
      valueLength: 6,
      path: '/',
      domain: 'example.com',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
      partitioned: true,
    });
  });

  it('prefers Max-Age over Expires and resolves Expires against now', () => {
    expect(
      parseSetCookie(
        'a=1; Expires=Fri, 02 Jan 2026 00:00:00 GMT; Max-Age=60',
        NOW,
      )?.maxAgeSeconds,
    ).toBe(60);
    expect(
      parseSetCookie('a=1; Expires=Fri, 02 Jan 2026 00:00:00 GMT', NOW)
        ?.maxAgeSeconds,
    ).toBe(86400);
  });

  it('ignores headers browsers ignore', () => {
    expect(parseSetCookie('novalue', NOW)).toBeNull();
    expect(parseSetCookie('=x', NOW)).toBeNull();
  });
});

describe('isSensitiveName', () => {
  it.each(['PHPSESSID', 'connect.sid', 'auth_token', 'JSESSIONID', 'jwt'])(
    '%s is sensitive',
    (n) => expect(isSensitiveName(n)).toBe(true),
  );
  it.each(['csrftoken', 'XSRF-TOKEN', 'theme', 'sidebar_state', '_ga'])(
    '%s is not sensitive',
    (n) => expect(isSensitiveName(n)).toBe(false),
  );
});

describe('auditCookie', () => {
  it('passes a hardened __Host- session cookie', () => {
    expect(
      check('__Host-session=x; Path=/; Secure; HttpOnly; SameSite=Strict'),
    ).toEqual({
      secure: 'pass',
      httponly: 'pass',
      samesite: 'pass',
      prefix: 'pass',
      domain: 'pass',
      lifetime: 'pass',
    });
  });

  it('fails a bare session cookie', () => {
    const r = check('PHPSESSID=x; Domain=example.com; Max-Age=31536000');
    expect(r.secure).toBe('fail');
    expect(r.httponly).toBe('fail');
    expect(r.samesite).toBe('warn');
    expect(r.domain).toBe('warn');
    expect(r.lifetime).toBe('warn');
  });

  it('is lenient with non-session cookies', () => {
    const r = check('theme=dark; Secure; SameSite=Lax; Max-Age=31536000');
    expect(r.httponly).toBe('info');
    expect(r.lifetime).toBe('info');
  });

  it('fails SameSite=None without Secure and broken prefixes', () => {
    expect(check('a=1; SameSite=None').samesite).toBe('fail');
    expect(check('__Host-a=1; Secure; Path=/; Domain=example.com').prefix).toBe(
      'fail',
    );
    expect(check('__Secure-a=1').prefix).toBe('fail');
  });
});

describe('dedupeCookies', () => {
  it('keeps the last cookie per name, domain and path', () => {
    const out = dedupeCookies([
      { name: 'a', id: 1 },
      { name: 'b', id: 2 },
      { name: 'a', id: 3 },
      { name: 'a', path: '/x', id: 4 },
    ]);
    expect(out.map((c) => c.id)).toEqual([2, 3, 4]);
  });
});

describe('cookieFindings', () => {
  it('has no grade without cookies', () => {
    const r = cookieFindings([]);
    expect(r.grade).toBeNull();
    expect(r.findings[0]?.id).toBe('cookies.none');
  });

  it('emits one finding per cookie and check and grades them', () => {
    const parsed = parseSetCookie('sid=1', NOW);
    if (!parsed) throw new Error('not parsed');
    const r = cookieFindings([auditCookie(parsed, 'https://x/', https)]);
    expect(r.findings).toHaveLength(6);
    expect(r.findings[0]?.id).toBe('cookie.sid.secure');
    expect(r.grade).not.toBeNull();
    expect(r.score).toBeLessThan(70);
  });
});
