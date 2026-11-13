import {
  detectTechnologies,
  extractGenerator,
  extractTitle,
} from './fingerprint.js';

const names = (out: ReturnType<typeof detectTechnologies>) =>
  out.map((d) => d.name);

describe('detectTechnologies', () => {
  it('reads server and language from headers with versions', () => {
    const out = detectTechnologies({
      headers: { server: 'nginx/1.25.3', 'x-powered-by': 'PHP/8.2.1' },
      cookieNames: [],
      html: '',
    });
    expect(out).toEqual([
      expect.objectContaining({
        name: 'PHP',
        version: '8.2.1',
        confidence: 'high',
      }),
      expect.objectContaining({
        name: 'nginx',
        version: '1.25.3',
        confidence: 'high',
      }),
    ]);
  });

  it('detects WordPress from generator and paths, and implies PHP', () => {
    const html = `<html><head>
      <meta content="WordPress 6.4.2" name="generator">
      <link rel="stylesheet" href="/wp-content/themes/x/style.css">
      <script src="/wp-includes/js/jquery/jquery.min.js"></script>
      <script src="/wp-content/plugins/woocommerce/assets/js/x.js"></script>
    </head></html>`;
    const out = detectTechnologies({ headers: {}, cookieNames: [], html });
    const wp = out.find((d) => d.name === 'WordPress')!;
    expect(wp.version).toBe('6.4.2');
    expect(wp.confidence).toBe('high');
    expect(wp.evidence.length).toBeGreaterThan(1);
    expect(names(out)).toEqual(
      expect.arrayContaining(['WooCommerce', 'jQuery', 'PHP']),
    );
    expect(out.find((d) => d.name === 'PHP')!.evidence).toEqual([
      'implied by WordPress',
    ]);
  });

  it('detects Next.js on Vercel behind no CDN, implying React', () => {
    const out = detectTechnologies({
      headers: { 'x-vercel-id': 'fra1::abc', server: 'Vercel' },
      cookieNames: [],
      html: '<script src="/_next/static/chunks/main.js"></script><script id="__NEXT_DATA__" type="application/json">{}</script>',
    });
    expect(names(out).sort()).toEqual(['Next.js', 'React', 'Vercel']);
  });

  it('uses cookies for CDN and runtime hints', () => {
    const out = detectTechnologies({
      headers: { 'cf-ray': '8a1b-ZRH' },
      cookieNames: ['__cf_bm', 'JSESSIONID'],
      html: '',
    });
    expect(names(out)).toEqual(['Cloudflare', 'Java']);
    expect(out[0]!.evidence).toEqual([
      'header cf-ray: 8a1b-ZRH',
      'cookie __cf_bm',
    ]);
  });

  it('finds nothing in a plain page', () => {
    expect(
      detectTechnologies({
        headers: {},
        cookieNames: [],
        html: '<html><body>hello bootstrap</body></html>',
      }),
    ).toEqual([]);
  });
});

describe('html helpers', () => {
  it('extracts generator and title', () => {
    expect(
      extractGenerator('<meta name="generator" content="Hugo 0.120.4" />'),
    ).toBe('Hugo 0.120.4');
    expect(extractTitle('<title>\n  My   Site </title>')).toBe('My Site');
    expect(extractTitle('<p>no title</p>')).toBeUndefined();
    expect(extractTitle('<title>A &#124; B &amp; C &#x2014; D</title>')).toBe(
      'A | B & C \u2014 D',
    );
  });
});
