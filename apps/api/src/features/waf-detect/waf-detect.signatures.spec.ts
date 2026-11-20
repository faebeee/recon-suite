import {
  isBlocked,
  mergeDetections,
  wafFindings,
} from './waf-detect.analysis.js';
import {
  cookieNames,
  matchSignatures,
  SIGNATURES,
} from './waf-detect.signatures.js';

const view = (
  headers: Record<string, string> = {},
  cookies: string[] = [],
  body = '',
) => ({ headers, cookies, body });

describe('matchSignatures', () => {
  it('recognises Cloudflare from headers and cookies', () => {
    const m = matchSignatures(
      view({ 'cf-ray': '8a1-FRA', server: 'cloudflare' }, ['__cf_bm']),
    );
    expect(m.get('Cloudflare')).toEqual([
      'cf-ray header',
      'server: cloudflare',
      '__cf_bm cookie',
    ]);
  });

  it('recognises CloudFront and Fastly side by side', () => {
    const m = matchSignatures(
      view({
        via: '1.1 abc.cloudfront.net (CloudFront)',
        'x-served-by': 'cache-fra-123',
      }),
    );
    expect([...m.keys()]).toEqual(['Amazon CloudFront', 'Fastly']);
  });

  it('recognises block pages', () => {
    const m = matchSignatures(
      view({}, [], 'Request unsuccessful. Incapsula incident ID: 123'),
    );
    expect(m.get('Imperva (Incapsula)')).toEqual(['Imperva block page']);
  });

  it('ignores ordinary responses', () => {
    expect(
      matchSignatures(
        view({ server: 'nginx/1.25.3', 'content-type': 'text/html' }, [
          'session',
        ]),
      ).size,
    ).toBe(0);
  });

  it('only uses lower-case header names (as fetch reports them)', () => {
    for (const s of SIGNATURES) {
      for (const [name] of s.headers ?? [])
        expect(name).toBe(name.toLowerCase());
    }
  });
});

describe('cookieNames', () => {
  it('extracts names', () => {
    expect(cookieNames(['a=1; Path=/', 'TS01ab12cd=x', 'broken'])).toEqual([
      'a',
      'TS01ab12cd',
      'broken',
    ]);
  });
});

describe('isBlocked', () => {
  it('compares the trigger answer with the normal one', () => {
    expect(isBlocked(200, { status: 403 })).toBe(true);
    expect(isBlocked(200, { error: 'socket hang up' })).toBe(true);
    expect(isBlocked(200, { status: 200 })).toBe(false);
    expect(isBlocked(404, { status: 403 })).toBe(false);
  });
});

describe('wafFindings', () => {
  it('reports detections, probe-only matches and the block result', () => {
    const detections = mergeDetections(
      new Map([['Cloudflare', ['cf-ray header']]]),
      new Map([
        ['Cloudflare', ['Cloudflare block page']],
        ['ModSecurity', ['ModSecurity error page']],
      ]),
    );
    expect(detections).toEqual([
      {
        name: 'Cloudflare',
        kinds: ['cdn', 'waf'],
        evidence: ['cf-ray header', 'Cloudflare block page'],
        probeOnly: false,
      },
      {
        name: 'ModSecurity',
        kinds: ['waf'],
        evidence: ['ModSecurity error page'],
        probeOnly: true,
      },
    ]);
    const f = wafFindings({
      finalUrl: 'https://x.test/',
      baseline: { url: 'https://x.test/', status: 200 },
      probe: { url: 'https://x.test/?…', status: 403, blocked: true },
      detections,
    });
    expect(f.map((x) => [x.id, x.status])).toEqual([
      ['edge.cloudflare', 'info'],
      ['edge.modsecurity', 'info'],
      ['waf.blocks', 'pass'],
    ]);
  });

  it('says so when nothing is recognised', () => {
    const f = wafFindings({
      finalUrl: 'https://x.test/',
      baseline: { url: 'https://x.test/', status: 200 },
      detections: [],
    });
    expect(f.map((x) => x.id)).toEqual(['edge.none']);
  });
});
