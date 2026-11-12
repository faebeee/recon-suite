import type { SecurityCheck, SecurityReport } from '@recon/shared';

const DISCLOSURE_HEADERS = [
  'server',
  'x-powered-by',
  'x-aspnet-version',
  'x-aspnetmvc-version',
  'x-generator',
  'x-drupal-cache',
  'x-runtime',
  'via',
];

const SIX_MONTHS = 15_552_000;

/** Grades a response's security headers. `headers` keys must be lowercase. */
export function analyzeSecurityHeaders(
  headers: Record<string, string>,
  isHttps: boolean,
): SecurityReport {
  const checks: SecurityCheck[] = [];
  const h = (name: string) => headers[name];

  // Transport
  if (!isHttps) {
    checks.push({
      header: 'strict-transport-security',
      status: 'fail',
      message: 'Served over plain HTTP',
    });
  } else {
    const hsts = h('strict-transport-security');
    const maxAge = Number(/max-age=(\d+)/i.exec(hsts ?? '')?.[1] ?? 0);
    checks.push(
      !hsts
        ? {
            header: 'strict-transport-security',
            status: 'fail',
            message: 'HSTS missing',
          }
        : maxAge < SIX_MONTHS
          ? {
              header: 'strict-transport-security',
              status: 'warn',
              message: `max-age ${maxAge}s is below 6 months`,
              value: hsts,
            }
          : {
              header: 'strict-transport-security',
              status: 'pass',
              message: 'HSTS enabled',
              value: hsts,
            },
    );
  }

  // Content Security Policy
  const csp = h('content-security-policy');
  checks.push(
    !csp
      ? { header: 'content-security-policy', status: 'fail', message: 'No CSP' }
      : /'unsafe-(inline|eval)'/.test(csp)
        ? {
            header: 'content-security-policy',
            status: 'warn',
            message: "CSP allows 'unsafe-inline' or 'unsafe-eval'",
            value: csp,
          }
        : {
            header: 'content-security-policy',
            status: 'pass',
            message: 'CSP present',
            value: csp,
          },
  );

  // Clickjacking
  const xfo = h('x-frame-options');
  const frameAncestors = /frame-ancestors/i.test(csp ?? '');
  checks.push(
    xfo || frameAncestors
      ? {
          header: 'x-frame-options',
          status: 'pass',
          message: frameAncestors
            ? 'CSP frame-ancestors set'
            : `X-Frame-Options ${xfo}`,
          value: xfo,
        }
      : {
          header: 'x-frame-options',
          status: 'fail',
          message: 'No clickjacking protection',
        },
  );

  const xcto = h('x-content-type-options');
  checks.push(
    xcto?.toLowerCase() === 'nosniff'
      ? {
          header: 'x-content-type-options',
          status: 'pass',
          message: 'nosniff',
          value: xcto,
        }
      : {
          header: 'x-content-type-options',
          status: 'fail',
          message: 'MIME sniffing not disabled',
          value: xcto,
        },
  );

  const rp = h('referrer-policy');
  checks.push(
    !rp
      ? {
          header: 'referrer-policy',
          status: 'warn',
          message: 'Browser default referrer policy',
        }
      : /unsafe-url|no-referrer-when-downgrade/.test(rp)
        ? {
            header: 'referrer-policy',
            status: 'warn',
            message: 'Leaks full referrer',
            value: rp,
          }
        : { header: 'referrer-policy', status: 'pass', message: rp, value: rp },
  );

  const pp = h('permissions-policy');
  checks.push(
    pp
      ? {
          header: 'permissions-policy',
          status: 'pass',
          message: 'Feature access restricted',
          value: pp,
        }
      : {
          header: 'permissions-policy',
          status: 'warn',
          message: 'No Permissions-Policy',
        },
  );

  const coop = h('cross-origin-opener-policy');
  checks.push(
    coop
      ? {
          header: 'cross-origin-opener-policy',
          status: 'pass',
          message: coop,
          value: coop,
        }
      : {
          header: 'cross-origin-opener-policy',
          status: 'warn',
          message: 'No COOP',
        },
  );

  const disclosures = DISCLOSURE_HEADERS.filter((name) => h(name)).map(
    (name) => ({
      header: name,
      value: h(name)!,
    }),
  );

  const points = checks.reduce(
    (sum, c) => sum + (c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0),
    0,
  );
  const score = Math.round((points / checks.length) * 100);

  return { grade: toGrade(score, checks), score, checks, disclosures };
}

function toGrade(
  score: number,
  checks: SecurityCheck[],
): SecurityReport['grade'] {
  if (checks.every((c) => c.status === 'pass')) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
