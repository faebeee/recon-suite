import type { TechCategory } from '@recon/shared';

/**
 * Fingerprint signatures. Capture group 1 of a pattern, when present, is the version.
 * Header and generator matches are "high" confidence; markup and cookie matches "medium".
 * Keep patterns specific: a false positive is worse than a miss in a recon report.
 */
export interface Signature {
  name: string;
  category: TechCategory;
  /** Lowercase header name -> pattern tested against the header value. */
  headers?: Record<string, RegExp>;
  /** Tested against each cookie name set by the response. */
  cookies?: RegExp;
  /** Tested against the <meta name="generator"> content. */
  generator?: RegExp;
  /** Tested against the HTML body. */
  html?: RegExp[];
  /** Other technologies this one implies (by name). */
  implies?: string[];
}

const V = '(?:[ /v]+(\\d+(?:\\.\\d+)*))?';
const header = (re: string) => new RegExp(re, 'i');

export const SIGNATURES: Signature[] = [
  // Servers
  {
    name: 'nginx',
    category: 'server',
    headers: { server: header(`^nginx${V}`) },
  },
  {
    name: 'OpenResty',
    category: 'server',
    headers: { server: header(`^openresty${V}`) },
    implies: ['nginx'],
  },
  {
    name: 'Apache HTTP Server',
    category: 'server',
    headers: { server: header(`^apache${V}`) },
  },
  {
    name: 'Microsoft IIS',
    category: 'server',
    headers: { server: header(`^microsoft-iis${V}`) },
  },
  {
    name: 'LiteSpeed',
    category: 'server',
    headers: { server: header('^litespeed') },
  },
  { name: 'Caddy', category: 'server', headers: { server: header('^caddy') } },
  {
    name: 'Envoy',
    category: 'server',
    headers: { server: header('^envoy'), 'x-envoy-upstream-service-time': /./ },
  },
  {
    name: 'Gunicorn',
    category: 'server',
    headers: { server: header(`^gunicorn${V}`) },
    implies: ['Python'],
  },
  {
    name: 'Kestrel',
    category: 'server',
    headers: { server: header('^kestrel') },
    implies: ['ASP.NET'],
  },
  {
    name: 'Jetty',
    category: 'server',
    headers: { server: header(`^jetty${V}`) },
    implies: ['Java'],
  },
  {
    name: 'Apache Tomcat',
    category: 'server',
    headers: { server: header('^apache-coyote') },
    implies: ['Java'],
  },
  {
    name: 'Google Web Server',
    category: 'server',
    headers: { server: header('^gws$') },
  },

  // Languages / runtimes
  {
    name: 'PHP',
    category: 'language',
    headers: { 'x-powered-by': header(`php${V}`) },
    cookies: /^PHPSESSID$/,
  },
  {
    name: 'ASP.NET',
    category: 'language',
    headers: {
      'x-powered-by': header('asp\\.net'),
      'x-aspnet-version': /(\d+(?:\.\d+)*)/,
      'x-aspnetmvc-version': /./,
    },
    cookies: /^ASP\.NET_SessionId$|^\.AspNetCore\./,
    html: [/<input[^>]+name="__VIEWSTATE"/i],
  },
  { name: 'Java', category: 'language', cookies: /^JSESSIONID$/ },
  { name: 'Node.js', category: 'language' },
  { name: 'Python', category: 'language' },
  { name: 'Ruby', category: 'language' },

  // Frameworks
  {
    name: 'Express',
    category: 'framework',
    headers: { 'x-powered-by': header('^express$') },
    implies: ['Node.js'],
  },
  {
    name: 'Next.js',
    category: 'framework',
    headers: { 'x-powered-by': header(`next\\.js${V}`), 'x-nextjs-cache': /./ },
    html: [/\/_next\/static\//, /<script id="__NEXT_DATA__"/],
    implies: ['React'],
  },
  {
    name: 'Nuxt',
    category: 'framework',
    html: [/\/_nuxt\//, /window\.__NUXT__/],
    implies: ['Vue.js'],
  },
  {
    name: 'Gatsby',
    category: 'framework',
    generator: /^gatsby\s*(\d+(?:\.\d+)*)?/i,
    html: [/<div id="___gatsby"/],
    implies: ['React'],
  },
  {
    name: 'Remix',
    category: 'framework',
    html: [/window\.__remixContext/],
    implies: ['React'],
  },
  {
    name: 'SvelteKit',
    category: 'framework',
    html: [/data-sveltekit-|__sveltekit_/],
    implies: ['Svelte'],
  },
  {
    name: 'Astro',
    category: 'framework',
    generator: /^astro\s*v?(\d+(?:\.\d+)*)?/i,
    html: [/<astro-island/, /data-astro-cid-/],
  },
  {
    name: 'Angular',
    category: 'framework',
    html: [/ng-version="(\d+(?:\.\d+)*)"/],
  },
  {
    name: 'Laravel',
    category: 'framework',
    cookies: /^laravel_session$/,
    implies: ['PHP'],
  },
  {
    name: 'Django',
    category: 'framework',
    html: [/name="csrfmiddlewaretoken"/],
    cookies: /^django_language$/,
    implies: ['Python'],
  },
  {
    name: 'Ruby on Rails',
    category: 'framework',
    html: [/<meta name="csrf-param" content="authenticity_token"/],
    implies: ['Ruby'],
  },
  {
    name: 'React',
    category: 'js-library',
    html: [/data-reactroot/, /react-dom(?:\.production)?(?:\.min)?\.js/],
  },
  {
    name: 'Vue.js',
    category: 'js-library',
    html: [
      /\sdata-v-[0-9a-f]{8}[\s=>]/,
      /vue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js/,
    ],
  },
  {
    name: 'Svelte',
    category: 'js-library',
    html: [/class="[^"]*\bsvelte-[a-z0-9]{6}\b/],
  },

  // CMS / site builders
  {
    name: 'WordPress',
    category: 'cms',
    generator: /^wordpress\s*(\d+(?:\.\d+)*)?/i,
    html: [/\/wp-(?:content|includes)\//],
    headers: { link: header('rel="https://api\\.w\\.org/"') },
    implies: ['PHP'],
  },
  {
    name: 'Drupal',
    category: 'cms',
    generator: /^drupal\s*(\d+)?/i,
    headers: {
      'x-drupal-cache': /./,
      'x-generator': header('^drupal\\s*(\\d+)?'),
    },
    html: [/\/sites\/default\/files\//],
    implies: ['PHP'],
  },
  {
    name: 'Joomla',
    category: 'cms',
    generator: /^joomla!?/i,
    implies: ['PHP'],
  },
  {
    name: 'TYPO3',
    category: 'cms',
    generator: /^typo3\s*(?:cms\s*)?(\d+(?:\.\d+)*)?/i,
    implies: ['PHP'],
  },
  {
    name: 'Ghost',
    category: 'cms',
    generator: /^ghost\s*(\d+(?:\.\d+)*)?/i,
    implies: ['Node.js'],
  },
  { name: 'Hugo', category: 'cms', generator: /^hugo\s*(\d+(?:\.\d+)*)?/i },
  {
    name: 'Jekyll',
    category: 'cms',
    generator: /^jekyll\s*v?(\d+(?:\.\d+)*)?/i,
  },
  {
    name: 'Wix',
    category: 'cms',
    headers: { 'x-wix-request-id': /./ },
    html: [/static\.wixstatic\.com/],
  },
  { name: 'Squarespace', category: 'cms', html: [/static1\.squarespace\.com/] },
  {
    name: 'Webflow',
    category: 'cms',
    generator: /^webflow/i,
    html: [/data-wf-page=/],
  },

  // E-commerce
  {
    name: 'Shopify',
    category: 'ecommerce',
    headers: { 'x-shopid': /./, 'x-shopify-stage': /./ },
    html: [/cdn\.shopify\.com/],
  },
  {
    name: 'WooCommerce',
    category: 'ecommerce',
    html: [/\/plugins\/woocommerce\//],
    implies: ['WordPress'],
  },
  {
    name: 'Magento',
    category: 'ecommerce',
    cookies: /^X-Magento-Vary$/,
    html: [/\/static\/version\d+\/frontend\//],
    implies: ['PHP'],
  },
  {
    name: 'PrestaShop',
    category: 'ecommerce',
    generator: /^prestashop/i,
    cookies: /^PrestaShop-/,
    implies: ['PHP'],
  },

  // CDN / edge
  {
    name: 'Cloudflare',
    category: 'cdn',
    headers: { 'cf-ray': /./, server: header('^cloudflare') },
    cookies: /^__cf_bm$|^__cfruid$/,
  },
  {
    name: 'Amazon CloudFront',
    category: 'cdn',
    headers: { 'x-amz-cf-id': /./, via: header('cloudfront') },
  },
  {
    name: 'Fastly',
    category: 'cdn',
    headers: { 'x-fastly-request-id': /./, 'x-served-by': header('^cache-') },
  },
  {
    name: 'Akamai',
    category: 'cdn',
    headers: {
      server: header('^akamaighost'),
      'akamai-grn': /./,
      'x-akamai-transformed': /./,
    },
  },
  {
    name: 'Varnish',
    category: 'cdn',
    headers: { 'x-varnish': /./, via: header('varnish') },
  },
  {
    name: 'Bunny CDN',
    category: 'cdn',
    headers: { server: header('^bunnycdn') },
  },
  {
    name: 'Azure Front Door',
    category: 'cdn',
    headers: { 'x-azure-ref': /./ },
  },
  {
    name: 'Google Cloud CDN',
    category: 'cdn',
    headers: { via: header('^1\\.1 google$') },
  },

  // Hosting / PaaS
  {
    name: 'Vercel',
    category: 'hosting',
    headers: { 'x-vercel-id': /./, server: header('^vercel') },
  },
  {
    name: 'Netlify',
    category: 'hosting',
    headers: { 'x-nf-request-id': /./, server: header('^netlify') },
  },
  {
    name: 'GitHub Pages',
    category: 'hosting',
    headers: { server: header('^github\\.com$') },
  },
  { name: 'Heroku', category: 'hosting', headers: { via: header('vegur') } },
  { name: 'Fly.io', category: 'hosting', headers: { 'fly-request-id': /./ } },
  {
    name: 'Render',
    category: 'hosting',
    headers: { 'x-render-origin-server': /./ },
  },
  {
    name: 'AWS Elastic Load Balancing',
    category: 'hosting',
    headers: { server: header('^awselb') },
    cookies: /^AWSALB(?:CORS)?$/,
  },

  // JavaScript libraries
  {
    name: 'jQuery',
    category: 'js-library',
    html: [
      /jquery[.-](\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i,
      /\/jquery(?:\.min)?\.js/i,
    ],
  },
  {
    name: 'Bootstrap',
    category: 'js-library',
    html: [
      /\/bootstrap(?:[.-](\d+\.\d+(?:\.\d+)?))?(?:\.bundle)?(?:\.min)?\.(?:css|js)/i,
    ],
  },
  {
    name: 'htmx',
    category: 'js-library',
    html: [
      /htmx(?:\.org)?(?:@(\d+\.\d+(?:\.\d+)?))?(?:\/dist\/htmx)?(?:\.min)?\.js/i,
    ],
  },
  {
    name: 'Alpine.js',
    category: 'js-library',
    html: [/alpinejs(?:@(\d+\.\d+(?:\.\d+)?))?/i],
  },

  // Analytics / marketing
  {
    name: 'Google Tag Manager',
    category: 'analytics',
    html: [/googletagmanager\.com\/gtm\.js/],
  },
  {
    name: 'Google Analytics',
    category: 'analytics',
    html: [
      /google-analytics\.com\/(?:analytics|ga)\.js/,
      /googletagmanager\.com\/gtag\/js/,
    ],
  },
  { name: 'Matomo', category: 'analytics', html: [/\/(?:matomo|piwik)\.js/] },
  { name: 'Plausible', category: 'analytics', html: [/plausible\.io\/js\//] },
  { name: 'Hotjar', category: 'analytics', html: [/static\.hotjar\.com/] },
  {
    name: 'Segment',
    category: 'analytics',
    html: [/cdn\.segment\.com\/analytics\.js/],
  },
  {
    name: 'Microsoft Clarity',
    category: 'analytics',
    html: [/www\.clarity\.ms\/tag\//],
  },
  {
    name: 'Meta Pixel',
    category: 'analytics',
    html: [/connect\.facebook\.net\/[^"']+\/fbevents\.js/],
  },

  // Security
  {
    name: 'reCAPTCHA',
    category: 'security',
    html: [/www\.(?:google|recaptcha)\.(?:com|net)\/recaptcha\//],
  },
  {
    name: 'hCaptcha',
    category: 'security',
    html: [/hcaptcha\.com\/1\/api\.js/],
  },
  {
    name: 'Cloudflare Turnstile',
    category: 'security',
    html: [/challenges\.cloudflare\.com\/turnstile\//],
  },
  { name: 'Sucuri', category: 'security', headers: { 'x-sucuri-id': /./ } },
  {
    name: 'Imperva',
    category: 'security',
    headers: { 'x-iinfo': /./ },
    cookies: /^incap_ses_|^visid_incap_/,
  },
];
