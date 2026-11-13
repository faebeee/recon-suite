import type {
  Finding,
  RobotsGroup,
  RobotsReport,
  SecurityTxtReport,
  SitemapReport,
} from '@recon/shared';

const MAX_GROUPS = 50;
const MAX_RULES_PER_GROUP = 200;
const MAX_SITEMAP_SAMPLE = 25;

/** Paths in robots.txt that are worth a manual look during an assessment. */
const INTERESTING =
  /admin|login|signin|auth|backup|bak|old|tmp|temp|private|internal|secret|staging|stage|dev|test|debug|api|graphql|config|setup|install|upload|\.git|\.env|\.svn|wp-admin|phpmyadmin|cgi-bin|console|dashboard|manage|portal/i;

/** True when a "found" response is really an HTML error/home page. */
export function isSoft404(contentType: string | undefined, body: string) {
  const looksHtml = /^\s*(<!doctype html|<html|<head|<body)/i.test(body);
  return looksHtml || (contentType?.includes('text/html') ?? false);
}

export function parseRobots(text: string): RobotsReport {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | undefined;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();

    if (key === 'sitemap') {
      if (value && sitemaps.length < 20) sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      if (!lastWasAgent || !current) {
        if (groups.length >= MAX_GROUPS) break;
        current = { userAgents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.userAgents.push(value);
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'disallow' && value) {
      if (current.disallow.length < MAX_RULES_PER_GROUP)
        current.disallow.push(value);
    } else if (key === 'allow' && value) {
      if (current.allow.length < MAX_RULES_PER_GROUP) current.allow.push(value);
    } else if (key === 'crawl-delay') {
      current.crawlDelay = value;
    }
  }

  const interesting = [
    ...new Set(
      groups
        .flatMap((g) => [...g.disallow, ...g.allow])
        .filter((p) => INTERESTING.test(p)),
    ),
  ].slice(0, 100);
  return { groups, sitemaps, interesting };
}

export function parseSitemap(url: string, xml: string): SitemapReport {
  const kind = /<sitemapindex[\s>]/i.test(xml)
    ? 'sitemapindex'
    : /<urlset[\s>]/i.test(xml)
      ? 'urlset'
      : 'unknown';
  const locs: string[] = [];
  let count = 0;
  for (const m of xml.matchAll(
    /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi,
  )) {
    count++;
    if (locs.length < MAX_SITEMAP_SAMPLE) locs.push(decodeXml(m[1]!));
  }
  return { url, kind, count, sample: locs };
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Parses and validates security.txt against RFC 9116. `now` is injectable for tests. */
export function parseSecurityTxt(
  text: string,
  fetchedUrl: string,
  now = new Date(),
): SecurityTxtReport {
  const signed = /-----BEGIN PGP SIGNED MESSAGE-----/.test(text);
  const body = signed
    ? text
        .replace(
          /^[\s\S]*?-----BEGIN PGP SIGNED MESSAGE-----[^\n]*\n(?:Hash:[^\n]*\n)*\n?/,
          '',
        )
        .replace(/-----BEGIN PGP SIGNATURE-----[\s\S]*$/, '')
    : text;

  const fields: { name: string; value: string }[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.+)$/.exec(line);
    if (m && fields.length < 100)
      fields.push({ name: m[1]!, value: m[2]!.trim() });
  }

  const get = (name: string) =>
    fields
      .filter((f) => f.name.toLowerCase() === name.toLowerCase())
      .map((f) => f.value);
  const findings: Finding[] = [];

  const contacts = get('Contact');
  findings.push({
    id: 'securitytxt.contact',
    status: contacts.length ? 'pass' : 'fail',
    title: 'Contact',
    message: contacts.length
      ? 'Contact field present.'
      : 'Required Contact field is missing.',
    value: contacts.join(', ') || undefined,
  });

  const expires = get('Expires');
  if (expires.length !== 1) {
    findings.push({
      id: 'securitytxt.expires',
      status: 'fail',
      title: 'Expires',
      message: expires.length
        ? 'Expires must appear exactly once.'
        : 'Required Expires field is missing.',
    });
  } else {
    const date = new Date(expires[0]!);
    const days = (date.getTime() - now.getTime()) / 86_400_000;
    findings.push(
      Number.isNaN(date.getTime())
        ? {
            id: 'securitytxt.expires',
            status: 'fail',
            title: 'Expires',
            message: 'Expires is not a valid RFC 3339 date.',
            value: expires[0],
          }
        : {
            id: 'securitytxt.expires',
            status: days < 0 ? 'fail' : days > 366 ? 'warn' : 'pass',
            title: 'Expires',
            message:
              days < 0
                ? 'The file has expired; researchers should treat it as stale.'
                : days > 366
                  ? 'Expires is more than a year away (RFC 9116 recommends less).'
                  : `Valid for ${Math.floor(days)} more days.`,
            value: expires[0],
          },
    );
  }

  if (!new URL(fetchedUrl).pathname.startsWith('/.well-known/')) {
    findings.push({
      id: 'securitytxt.location',
      status: 'warn',
      title: 'Location',
      message:
        'Served from the legacy /security.txt path; use /.well-known/security.txt.',
    });
  }

  const canonical = get('Canonical');
  if (canonical.length && !canonical.includes(fetchedUrl)) {
    findings.push({
      id: 'securitytxt.canonical',
      status: 'warn',
      title: 'Canonical',
      message: 'The fetched URL is not listed in Canonical.',
      value: canonical.join(', '),
    });
  }
  findings.push({
    id: 'securitytxt.signed',
    status: signed ? 'pass' : 'info',
    title: 'Signature',
    message: signed
      ? 'OpenPGP cleartext signature present (not verified).'
      : 'Not signed (optional).',
  });

  return { fields, signed, findings };
}
