import type {
  CorsTest,
  CorsTestId,
  Finding,
  FindingStatus,
} from '@recon/shared';

export const ARBITRARY_ORIGIN = 'https://recon-suite-cors-check.example';

export interface CorsProbe {
  id: CorsTestId;
  origin?: string;
  method: 'GET' | 'OPTIONS';
}

/** Response headers relevant for CORS, as read from one probe response. */
export interface CorsHeaders {
  status: number;
  allowOrigin?: string;
  allowCredentials: boolean;
  allowMethods?: string;
  allowHeaders?: string;
  vary?: string;
}

export const CORS_TEST_TITLES: Record<CorsTestId, string> = {
  baseline: 'Baseline (no Origin)',
  'arbitrary-origin': 'Arbitrary origin',
  'null-origin': 'null origin',
  'suffix-match': 'Suffix match bypass',
  'prefix-match': 'Prefix match bypass',
  'http-downgrade': 'HTTP origin on HTTPS site',
  preflight: 'Preflight (PUT + Authorization)',
};

/** The probes to run against `url`. The http-downgrade probe only applies to https targets. */
export function buildProbes(url: string): CorsProbe[] {
  const u = new URL(url);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const probes: CorsProbe[] = [
    { id: 'baseline', method: 'GET' },
    { id: 'arbitrary-origin', origin: ARBITRARY_ORIGIN, method: 'GET' },
    { id: 'null-origin', origin: 'null', method: 'GET' },
    { id: 'suffix-match', origin: `https://evil${host}`, method: 'GET' },
    {
      id: 'prefix-match',
      origin: `https://${host}.recon-suite-cors-check.example`,
      method: 'GET',
    },
  ];
  if (u.protocol === 'https:') {
    probes.push({
      id: 'http-downgrade',
      origin: `http://${u.host}`,
      method: 'GET',
    });
  }
  probes.push({ id: 'preflight', origin: ARBITRARY_ORIGIN, method: 'OPTIONS' });
  return probes;
}

/** Reads CORS headers from a header getter (undici/fetch `Headers`). */
export function readCorsHeaders(
  status: number,
  headers: { get(name: string): string | null },
): CorsHeaders {
  const opt = (name: string) => headers.get(name)?.trim() || undefined;
  return {
    status,
    allowOrigin: opt('access-control-allow-origin'),
    allowCredentials:
      headers.get('access-control-allow-credentials')?.trim().toLowerCase() ===
      'true',
    allowMethods: opt('access-control-allow-methods'),
    allowHeaders: opt('access-control-allow-headers'),
    vary: opt('vary'),
  };
}

const listHas = (list: string | undefined, value: string) =>
  !!list &&
  list
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .some((s) => s === '*' || s === value.toLowerCase());

/** Verdict for one probe as a pure function of the response headers. */
export function evaluateCors(
  probe: CorsProbe,
  h: CorsHeaders,
): { verdict: FindingStatus; message: string } {
  const acao = h.allowOrigin;
  const creds = h.allowCredentials;

  if (!acao) {
    return {
      verdict: 'pass',
      message: probe.origin
        ? 'No Access-Control-Allow-Origin returned for this origin.'
        : 'No CORS headers without an Origin.',
    };
  }
  if (acao === '*') {
    return {
      verdict: 'info',
      message: creds
        ? 'Wildcard origin with credentials: browsers refuse this combination, so credentialed reads are blocked, but the configuration is broken.'
        : 'Wildcard origin without credentials: the resource is public to any site (fine for public data).',
    };
  }

  const reflected = !!probe.origin && acao === probe.origin;
  if (!reflected) {
    return {
      verdict: probe.origin ? 'pass' : 'info',
      message: probe.origin
        ? `Origin not reflected; the server allows only ${acao}.`
        : `Fixed allowed origin: ${acao}.`,
    };
  }

  const varyNote = listHas(h.vary, 'origin')
    ? ''
    : ' The response lacks "Vary: Origin", so shared caches may serve the reflected header to other origins (cache poisoning risk).';

  let verdict: FindingStatus;
  let message: string;
  switch (probe.id) {
    case 'null-origin':
      verdict = creds ? 'fail' : 'warn';
      message = creds
        ? 'The "null" origin is allowed with credentials: sandboxed iframes and local files can read authenticated responses.'
        : 'The "null" origin is allowed (without credentials).';
      break;
    case 'http-downgrade':
      verdict = creds ? 'warn' : 'info';
      message = creds
        ? 'The plain-HTTP origin of this site is trusted with credentials: a network attacker (MitM) can inject script into http:// and read authenticated HTTPS responses.'
        : 'The plain-HTTP origin of this site is allowed (without credentials).';
      break;
    case 'preflight': {
      const dangerous =
        listHas(h.allowMethods, 'PUT') ||
        listHas(h.allowHeaders, 'authorization');
      verdict = creds && dangerous ? 'fail' : 'warn';
      message =
        creds && dangerous
          ? 'Preflight allows an arbitrary origin with credentials and PUT/Authorization: any site can send authenticated state-changing requests and read the answers.'
          : creds
            ? 'Preflight reflects an arbitrary origin with credentials (PUT/Authorization not allowed).'
            : 'Preflight reflects an arbitrary origin (without credentials).';
      break;
    }
    case 'suffix-match':
    case 'prefix-match':
    case 'arbitrary-origin':
    case 'baseline': {
      const what =
        probe.id === 'suffix-match'
          ? 'An origin that only ends with the host name'
          : probe.id === 'prefix-match'
            ? 'An origin that only starts with the host name'
            : 'An arbitrary origin';
      verdict = creds ? 'fail' : 'warn';
      message = creds
        ? `${what} is reflected with credentials: any such site can read authenticated responses.`
        : `${what} is reflected (without credentials): any such site can read unauthenticated responses.`;
      break;
    }
  }
  return { verdict, message: message + varyNote };
}

/** One finding per failing/warning test, or a single pass. */
export function corsFindings(tests: CorsTest[]): Finding[] {
  const bad = tests.filter((t) => t.verdict === 'fail' || t.verdict === 'warn');
  if (!bad.length) {
    return [
      {
        id: 'cors.policy',
        status: 'pass',
        title: 'CORS policy',
        message: tests.some((t) => t.error)
          ? 'No permissive CORS behaviour found (some tests failed to run).'
          : 'No untrusted origin is reflected.',
      },
    ];
  }
  return bad.map((t) => ({
    id: `cors.${t.id}`,
    status: t.verdict,
    title: CORS_TEST_TITLES[t.id],
    message: t.message,
    value: `Origin: ${t.origin ?? '-'}; ACAO: ${t.allowOrigin ?? '-'}; ACAC: ${t.allowCredentials}`,
  }));
}
