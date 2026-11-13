import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { Response } from 'undici';
import type { HttpClientService } from '../../core/http/http-client.service.js';
import {
  matchFingerprint,
  matchProvider,
  TAKEOVER_PROVIDERS,
} from './providers.js';
import {
  buildTakeoverFindings,
  classify,
  parseCtNames,
  resolveChain,
  type TakeoverDns,
} from './takeover.analysis.js';
import { TakeoverService } from './takeover.service.js';

const err = (code: string) => Object.assign(new Error(code), { code });

/** Fake DNS: `cnames` maps name -> target, `addrs` lists names that resolve. */
function fakeDns(
  cnames: Record<string, string>,
  addrs: string[],
  nodata: string[] = [],
): TakeoverDns {
  const exists = (n: string) =>
    n in cnames || addrs.includes(n) || nodata.includes(n);
  return {
    cname: vi.fn(async (n: string) => {
      if (cnames[n]) return [cnames[n]];
      throw err(exists(n) ? 'ENODATA' : 'ENOTFOUND');
    }),
    addresses: vi.fn(async (n: string) => {
      if (addrs.includes(n)) return ['192.0.2.1'];
      throw err(exists(n) ? 'ENODATA' : 'ENOTFOUND');
    }),
  };
}

describe('providers', () => {
  it('matches CNAME suffixes on label boundaries', () => {
    expect(matchProvider(['b.s3.amazonaws.com'])?.name).toBe('AWS S3');
    expect(matchProvider(['b.s3-website-us-east-1.amazonaws.com'])?.name).toBe(
      'AWS S3',
    );
    expect(matchProvider(['x.elb.amazonaws.com'])).toBeUndefined();
    expect(matchProvider(['app.azurewebsites.net'])?.name).toBe(
      'Microsoft Azure',
    );
    expect(matchProvider(['evilgithub.io'])).toBeUndefined();
    expect(matchProvider(['a.example.net', 'u.github.io'])?.name).toBe(
      'GitHub Pages',
    );
  });

  it('only lists services with a CNAME pattern and an evidence rule', () => {
    for (const p of TAKEOVER_PROVIDERS) {
      expect(p.cname.length).toBeGreaterThan(0);
      expect(!!p.nxdomain || !!p.fingerprints?.length).toBe(true);
    }
  });

  it('matches string and regex fingerprints', () => {
    const wp = matchProvider(['x.wordpress.com'])!;
    expect(
      matchFingerprint(wp, '<p>Do you want to register foo.wordpress.com?</p>'),
    ).toBe('Do you want to register foo.wordpress.com?');
    expect(matchFingerprint(wp, 'hello')).toBeUndefined();
  });
});

describe('resolveChain', () => {
  it('follows hops and detects a dangling end', async () => {
    const dns = fakeDns(
      { 'a.x.test': 'b.cdn.test', 'b.cdn.test': 'gone.s3.amazonaws.com' },
      [],
    );
    expect(await resolveChain('a.x.test', dns)).toEqual({
      chain: ['b.cdn.test', 'gone.s3.amazonaws.com'],
      dangling: true,
      hostMissing: false,
    });
  });

  it('returns an empty chain for plain hosts and missing hosts', async () => {
    const dns = fakeDns({}, ['www.x.test']);
    expect(await resolveChain('www.x.test', dns)).toMatchObject({
      chain: [],
      dangling: false,
    });
    expect(await resolveChain('nope.x.test', dns)).toMatchObject({
      hostMissing: true,
    });
  });

  it('stops after the hop limit and on loops', async () => {
    const dns = fakeDns({ 'a.t': 'b.t', 'b.t': 'a.t' }, ['a.t', 'b.t']);
    expect((await resolveChain('a.t', dns)).chain).toEqual(['b.t']);
    const long = fakeDns(
      Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [`h${i}.t`, `h${i + 1}.t`]),
      ),
      ['h5.t'],
    );
    expect((await resolveChain('h0.t', long)).chain).toHaveLength(5);
  });

  it('reports other DNS errors', async () => {
    const dns: TakeoverDns = {
      cname: async () => {
        throw err('ETIMEOUT');
      },
      addresses: async () => [],
    };
    expect((await resolveChain('a.t', dns)).error).toMatch(/ETIMEOUT/);
  });
});

describe('classify', () => {
  const chain = (c: string[], dangling = false) => ({
    chain: c,
    dangling,
    hostMissing: false,
  });
  const p = (cname: string) => matchProvider([cname]);

  it('covers each decision', () => {
    const s3 = 'b.s3.amazonaws.com';
    expect(
      classify('a.x', chain([s3]), p(s3), {
        text: '<Code>NoSuchBucket</Code> The specified bucket does not exist',
      }).status,
    ).toBe('vulnerable');
    expect(classify('a.x', chain([s3]), p(s3), { text: 'ok' }).status).toBe(
      'safe',
    );
    expect(
      classify('a.x', chain([s3]), p(s3), { error: 'blocked' }),
    ).toMatchObject({
      status: 'unknown',
      reason: expect.stringContaining('blocked'),
    });
    expect(classify('a.x', chain([s3], true), p(s3)).status).toBe('likely');

    const az = 'gone.azurewebsites.net';
    expect(classify('a.x', chain([az], true), p(az)).status).toBe('vulnerable');
    expect(classify('a.x', chain([az]), p(az)).status).toBe('safe');

    const gh = 'u.github.io';
    expect(
      classify('a.x', chain([gh]), p(gh), {
        text: "There isn't a GitHub Pages site here.",
      }).status,
    ).toBe('likely');

    expect(
      classify('a.x', chain(['x.unknown.test'], true), undefined),
    ).toMatchObject({
      status: 'likely',
      reason: expect.stringContaining('unknown provider'),
    });
    expect(classify('a.x', chain(['x.unknown.test']), undefined).status).toBe(
      'safe',
    );
  });

  it('builds findings', () => {
    const c = classify(
      'a.x',
      chain(['gone.azurewebsites.net'], true),
      p('gone.azurewebsites.net'),
    );
    expect(buildTakeoverFindings([c], 3)).toEqual([
      expect.objectContaining({ id: 'takeover.a.x', status: 'fail' }),
    ]);
    expect(buildTakeoverFindings([], 3)[0]!.status).toBe('pass');
  });
});

describe('parseCtNames', () => {
  it('dedupes, strips wildcards and keeps only names of the domain', () => {
    expect(
      parseCtNames(
        [
          { name_value: '*.x.test\nwww.x.test' },
          { name_value: 'WWW.x.test\nevil-x.test\nx.test' },
          { name_value: 'a.*.x.test' },
        ],
        'x.test',
      ),
    ).toEqual(['www.x.test', 'x.test']);
  });
});

describe('TakeoverService', () => {
  const http = (opts: {
    ct?: Response | Error;
    bodies?: Record<string, string>;
  }) => {
    const targetFollow = vi.fn(async (url: string) => {
      const host = new URL(url).hostname;
      if (host === 'blocked.x.test')
        throw new ForbiddenException('private address');
      return {
        res: new Response(opts.bodies?.[host] ?? 'fine'),
        finalUrl: url,
        redirects: 0,
      };
    });
    const trusted = vi.fn(async () => {
      if (opts.ct instanceof Error) throw opts.ct;
      return opts.ct ?? new Response('[]');
    });
    return {
      targetFollow,
      trusted,
      client: { targetFollow, trusted } as unknown as HttpClientService,
    };
  };

  it('checks CT subdomains and reports candidates sorted by severity', async () => {
    const h = http({
      ct: new Response(
        JSON.stringify([
          { name_value: 'shop.x.test\nold.x.test\nwww.x.test\n*.x.test' },
          { name_value: 'blocked.x.test\nfoo.other.test' },
        ]),
      ),
      bodies: { 'shop.x.test': 'The specified bucket does not exist' },
    });
    const service = new TakeoverService(h.client);
    service.dns = fakeDns(
      {
        'shop.x.test': 'shop.s3.amazonaws.com',
        'old.x.test': 'old-app.azurewebsites.net',
        'blocked.x.test': 'site.s3.amazonaws.com',
        'www.x.test': 'edge.cdn.test',
      },
      [
        'x.test',
        'shop.s3.amazonaws.com',
        'site.s3.amazonaws.com',
        'edge.cdn.test',
      ],
    );
    const out = await service.check({
      target: 'x.test',
      source: 'ct',
      hosts: [],
    });
    expect(out.checked).toBe(5);
    expect(out.candidates.map((c) => [c.host, c.status])).toEqual([
      ['old.x.test', 'vulnerable'],
      ['shop.x.test', 'vulnerable'],
      ['blocked.x.test', 'unknown'],
      ['www.x.test', 'safe'],
    ]);
    // no body fetch for dangling or unmatched hosts
    expect(h.targetFollow.mock.calls.map((c) => c[0]).sort()).toEqual([
      'http://blocked.x.test/',
      'http://shop.x.test/',
    ]);
    expect(out.findings.filter((f) => f.status === 'fail')).toHaveLength(2);
  });

  it('uses only the domain and the given hosts with source=list', async () => {
    const h = http({});
    const service = new TakeoverService(h.client);
    service.dns = fakeDns({}, ['x.test', 'a.x.test']);
    const out = await service.check({
      target: 'x.test',
      source: 'list',
      hosts: ['a.x.test', 'x.test'],
    });
    expect(h.trusted).not.toHaveBeenCalled();
    expect(out.checked).toBe(2);
    expect(out.candidates).toEqual([]);
    expect(out.findings[0]!.status).toBe('pass');
  });

  it('answers 502 when crt.sh fails', async () => {
    const service = new TakeoverService(
      http({ ct: new Response('busy', { status: 503 }) }).client,
    );
    service.dns = fakeDns({}, []);
    await expect(
      service.check({ target: 'x.test', source: 'ct', hosts: [] }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
