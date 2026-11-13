import type { CorsTest } from '@recon/shared';
import {
  ARBITRARY_ORIGIN,
  buildProbes,
  corsFindings,
  evaluateCors,
  readCorsHeaders,
  type CorsHeaders,
  type CorsProbe,
} from './cors.analysis.js';

const h = (over: Partial<CorsHeaders> = {}): CorsHeaders => ({
  status: 200,
  allowCredentials: false,
  ...over,
});
const arb: CorsProbe = {
  id: 'arbitrary-origin',
  origin: ARBITRARY_ORIGIN,
  method: 'GET',
};

describe('buildProbes', () => {
  it('derives origins from the host and adds downgrade only for https', () => {
    const https = buildProbes('https://example.com:8443/a');
    expect(https.map((p) => p.id)).toEqual([
      'baseline',
      'arbitrary-origin',
      'null-origin',
      'suffix-match',
      'prefix-match',
      'http-downgrade',
      'preflight',
    ]);
    expect(https.find((p) => p.id === 'suffix-match')?.origin).toBe(
      'https://evilexample.com',
    );
    expect(https.find((p) => p.id === 'prefix-match')?.origin).toBe(
      'https://example.com.recon-suite-cors-check.example',
    );
    expect(https.find((p) => p.id === 'http-downgrade')?.origin).toBe(
      'http://example.com:8443',
    );
    expect(https.find((p) => p.id === 'preflight')?.method).toBe('OPTIONS');
    expect(
      buildProbes('http://example.com/').some((p) => p.id === 'http-downgrade'),
    ).toBe(false);
  });
});

describe('readCorsHeaders', () => {
  it('reads and normalises CORS headers', () => {
    const headers = new Headers({
      'access-control-allow-origin': ' https://a.test ',
      'access-control-allow-credentials': 'TRUE',
      vary: 'Origin',
    });
    expect(readCorsHeaders(204, headers)).toEqual({
      status: 204,
      allowOrigin: 'https://a.test',
      allowCredentials: true,
      allowMethods: undefined,
      allowHeaders: undefined,
      vary: 'Origin',
    });
  });
});

describe('evaluateCors', () => {
  it('passes without ACAO', () => {
    expect(evaluateCors(arb, h()).verdict).toBe('pass');
  });

  it('fails reflection with credentials and warns without', () => {
    const withCreds = evaluateCors(
      arb,
      h({
        allowOrigin: ARBITRARY_ORIGIN,
        allowCredentials: true,
        vary: 'Origin',
      }),
    );
    expect(withCreds.verdict).toBe('fail');
    expect(withCreds.message).not.toMatch(/cache poisoning/);
    const noCreds = evaluateCors(arb, h({ allowOrigin: ARBITRARY_ORIGIN }));
    expect(noCreds.verdict).toBe('warn');
    expect(noCreds.message).toMatch(/cache poisoning/);
  });

  it('treats wildcards as info', () => {
    expect(evaluateCors(arb, h({ allowOrigin: '*' })).verdict).toBe('info');
    const both = evaluateCors(
      arb,
      h({ allowOrigin: '*', allowCredentials: true }),
    );
    expect(both.verdict).toBe('info');
    expect(both.message).toMatch(/browsers refuse/);
  });

  it('passes a fixed allow-list that does not reflect', () => {
    expect(
      evaluateCors(
        arb,
        h({ allowOrigin: 'https://app.example.com', allowCredentials: true }),
      ).verdict,
    ).toBe('pass');
  });

  it('fails null with credentials', () => {
    const p: CorsProbe = { id: 'null-origin', origin: 'null', method: 'GET' };
    expect(
      evaluateCors(p, h({ allowOrigin: 'null', allowCredentials: true }))
        .verdict,
    ).toBe('fail');
    expect(evaluateCors(p, h({ allowOrigin: 'null' })).verdict).toBe('warn');
  });

  it('warns for http downgrade with credentials', () => {
    const p: CorsProbe = {
      id: 'http-downgrade',
      origin: 'http://example.com',
      method: 'GET',
    };
    expect(
      evaluateCors(p, h({ allowOrigin: p.origin, allowCredentials: true }))
        .verdict,
    ).toBe('warn');
    expect(evaluateCors(p, h({ allowOrigin: p.origin })).verdict).toBe('info');
  });

  it('fails preflight that allows PUT/Authorization with credentials', () => {
    const p: CorsProbe = {
      id: 'preflight',
      origin: ARBITRARY_ORIGIN,
      method: 'OPTIONS',
    };
    const base = { allowOrigin: ARBITRARY_ORIGIN, allowCredentials: true };
    expect(
      evaluateCors(p, h({ ...base, allowMethods: 'GET, PUT' })).verdict,
    ).toBe('fail');
    expect(
      evaluateCors(p, h({ ...base, allowHeaders: 'Authorization' })).verdict,
    ).toBe('fail');
    expect(evaluateCors(p, h({ ...base, allowMethods: 'GET' })).verdict).toBe(
      'warn',
    );
  });
});

describe('corsFindings', () => {
  const test = (over: Partial<CorsTest>): CorsTest => ({
    id: 'baseline',
    method: 'GET',
    allowCredentials: false,
    verdict: 'pass',
    message: 'ok',
    ...over,
  });

  it('returns one pass when nothing is wrong', () => {
    expect(corsFindings([test({}), test({ verdict: 'info' })])).toEqual([
      expect.objectContaining({ id: 'cors.policy', status: 'pass' }),
    ]);
  });

  it('returns one finding per warning/failing test', () => {
    const f = corsFindings([
      test({}),
      test({ id: 'null-origin', verdict: 'fail', origin: 'null' }),
      test({ id: 'suffix-match', verdict: 'warn' }),
    ]);
    expect(f.map((x) => [x.id, x.status])).toEqual([
      ['cors.null-origin', 'fail'],
      ['cors.suffix-match', 'warn'],
    ]);
  });
});
