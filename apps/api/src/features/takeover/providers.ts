/**
 * Takeover-prone services, modelled on https://github.com/EdOverflow/can-i-take-over-xyz
 * (status as of 2026-11). Only entries listed there as "Vulnerable" can produce a
 * `vulnerable` verdict; "Edge case" entries are capped at `likely` because claiming
 * depends on account or verification details. "Not vulnerable" services are omitted.
 * Fingerprints are the exact strings from that list.
 */
export interface TakeoverProvider {
  name: string;
  /** Matched against every name in the CNAME chain. */
  cname: RegExp[];
  /** Body markers of an unclaimed resource (fetched over HTTP). */
  fingerprints?: (string | RegExp)[];
  /** A dangling CNAME (NXDOMAIN) to this service can be claimed. */
  nxdomain?: boolean;
  /** Listed as "Edge case": a match is reported as `likely`, never `vulnerable`. */
  edgeCase?: boolean;
}

const suffix = (...domains: string[]) =>
  domains.map((d) => new RegExp(`(^|\\.)${d.replace(/\./g, '\\.')}\\.?$`, 'i'));

export const TAKEOVER_PROVIDERS: TakeoverProvider[] = [
  {
    name: 'AWS S3',
    cname: [/(^|\.)s3([.-][a-z0-9-]+)*\.amazonaws\.com\.?$/i],
    fingerprints: ['The specified bucket does not exist'],
  },
  {
    name: 'AWS Elastic Beanstalk',
    cname: suffix('elasticbeanstalk.com'),
    nxdomain: true,
  },
  {
    name: 'Microsoft Azure',
    cname: suffix(
      'cloudapp.net',
      'cloudapp.azure.com',
      'azurewebsites.net',
      'blob.core.windows.net',
      'azure-api.net',
      'azurehdinsight.net',
      'azureedge.net',
      'azurecontainer.io',
      'database.windows.net',
      'azuredatalakestore.net',
      'search.windows.net',
      'azurecr.io',
      'redis.cache.windows.net',
      'servicebus.windows.net',
      'visualstudio.com',
      'trafficmanager.net',
    ),
    nxdomain: true,
  },
  {
    name: 'Agile CRM',
    cname: suffix('agilecrm.com'),
    fingerprints: ['Sorry, this page is no longer available.'],
  },
  {
    name: 'Airee.ru',
    cname: suffix('airee.ru'),
    fingerprints: ['Ошибка 402. Сервис Айри.рф не оплачен'],
  },
  {
    name: 'Anima',
    cname: suffix('animaapp.io'),
    fingerprints: ['The page you were looking for does not exist.'],
  },
  {
    name: 'Bitbucket',
    cname: suffix('bitbucket.io'),
    fingerprints: ['Repository not found'],
  },
  {
    name: 'Campaign Monitor',
    cname: suffix('createsend.com'),
    fingerprints: ['Trying to access your account?'],
  },
  {
    name: 'Canny',
    cname: suffix('canny.io'),
    fingerprints: [
      'Company Not Found',
      'There is no such company. Did you enter the right URL?',
    ],
  },
  {
    name: 'Cargo Collective',
    cname: suffix('cargocollective.com'),
    fingerprints: ['404 Not Found'],
  },
  {
    name: 'Discourse',
    cname: suffix('trydiscourse.com'),
    nxdomain: true,
  },
  {
    name: 'Gemfury',
    cname: suffix('furyns.com'),
    fingerprints: ['404: This page could not be found.'],
  },
  {
    name: 'Ghost',
    cname: suffix('ghost.io'),
    fingerprints: [
      'Site unavailable.',
      'Failed to resolve DNS path for this host',
    ],
  },
  {
    name: 'HatenaBlog',
    cname: suffix('hatenablog.com'),
    fingerprints: ['404 Blog is not found'],
  },
  {
    name: 'Help Juice',
    cname: suffix('helpjuice.com'),
    fingerprints: ["We could not find what you're looking for."],
  },
  {
    name: 'Help Scout',
    cname: suffix('helpscoutdocs.com'),
    fingerprints: ['No settings were found for this company:'],
  },
  {
    name: 'JetBrains YouTrack',
    cname: suffix('youtrack.cloud'),
    fingerprints: ['is not a registered InCloud YouTrack'],
  },
  {
    name: 'Ngrok',
    cname: suffix('ngrok.io'),
    fingerprints: [/Tunnel \S+\.ngrok\.io not found/],
  },
  {
    name: 'Pantheon',
    cname: suffix('pantheonsite.io'),
    fingerprints: ['404 error unknown site!'],
  },
  {
    name: 'Pingdom',
    cname: suffix('stats.pingdom.com'),
    fingerprints: ["Sorry, couldn't find the status page"],
  },
  {
    name: 'Readme.io',
    cname: suffix('readme.io'),
    fingerprints: [
      'The creators of this project are still working on making everything perfect!',
    ],
  },
  {
    name: 'Read the Docs',
    cname: suffix('readthedocs.io'),
    fingerprints: [
      'The link you have followed or the URL that you entered does not exist.',
    ],
  },
  {
    name: 'Strikingly',
    cname: suffix('strikinglydns.com'),
    fingerprints: ['PAGE NOT FOUND.'],
  },
  {
    name: 'Surge.sh',
    cname: suffix('surge.sh'),
    fingerprints: ['project not found'],
  },
  {
    name: 'SurveySparrow',
    cname: suffix('surveysparrow.com'),
    fingerprints: ['Account not found.'],
  },
  {
    name: 'Uberflip',
    cname: suffix('read.uberflip.com'),
    fingerprints: ["The URL you've accessed does not provide a hub."],
  },
  {
    name: 'UptimeRobot',
    cname: suffix('stats.uptimerobot.com'),
    fingerprints: ['page not found'],
  },
  {
    name: 'WordPress.com',
    cname: suffix('wordpress.com'),
    fingerprints: [/Do you want to register \S+\.wordpress\.com\?/],
  },
  {
    name: 'Worksites',
    cname: suffix('worksites.net'),
    fingerprints: [
      'Hello! Sorry, but the website you&rsquo;re looking for doesn&rsquo;t exist.',
    ],
  },
  // "Edge case" entries: reported as likely at most.
  {
    name: 'GitHub Pages',
    cname: suffix('github.io'),
    fingerprints: ["There isn't a GitHub Pages site here."],
    edgeCase: true,
  },
  {
    name: 'Heroku',
    cname: suffix('herokuapp.com', 'herokudns.com', 'herokussl.com'),
    fingerprints: ['No such app'],
    edgeCase: true,
  },
  {
    name: 'Shopify',
    cname: suffix('myshopify.com'),
    fingerprints: ['Sorry, this shop is currently unavailable.'],
    edgeCase: true,
  },
  {
    name: 'Netlify',
    cname: suffix('netlify.app', 'netlify.com'),
    fingerprints: ['Not Found - Request ID:'],
    edgeCase: true,
  },
  {
    name: 'Vercel',
    cname: suffix('vercel.app', 'vercel-dns.com'),
    fingerprints: ['DEPLOYMENT_NOT_FOUND'],
    edgeCase: true,
  },
  {
    name: 'Webflow',
    cname: suffix('proxy-ssl.webflow.com', 'webflow.io'),
    fingerprints: [
      "The page you are looking for doesn't exist or has been moved.",
    ],
    edgeCase: true,
  },
  {
    name: 'Tilda',
    cname: suffix('tilda.ws'),
    fingerprints: ['Please renew your subscription'],
    edgeCase: true,
  },
  {
    name: 'Tumblr',
    cname: suffix('domains.tumblr.com'),
    fingerprints: [
      "Whatever you were looking for doesn't currently exist at this address",
    ],
    edgeCase: true,
  },
  {
    name: 'Wix',
    cname: suffix('wixdns.net'),
    fingerprints: ["Looks Like This Domain Isn't Connected To A Website Yet!"],
    edgeCase: true,
  },
  {
    name: 'Intercom',
    cname: suffix('custom.intercom.help'),
    fingerprints: ["Uh oh. That page doesn't exist."],
    edgeCase: true,
  },
];

/** First provider whose CNAME pattern matches any name in the chain. */
export function matchProvider(
  chain: string[],
  providers: TakeoverProvider[] = TAKEOVER_PROVIDERS,
): TakeoverProvider | undefined {
  return providers.find((p) =>
    chain.some((name) => p.cname.some((re) => re.test(name))),
  );
}

/** The fingerprint found in `body`, if any. */
export function matchFingerprint(
  provider: TakeoverProvider,
  body: string,
): string | undefined {
  for (const fp of provider.fingerprints ?? []) {
    if (typeof fp === 'string' ? body.includes(fp) : fp.test(body)) {
      return typeof fp === 'string' ? fp : (fp.exec(body)?.[0] ?? fp.source);
    }
  }
  return undefined;
}
