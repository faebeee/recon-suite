import type { DirBusterHit, DirBusterKind, Finding } from '@recon/shared';

/** What a probe answered, reduced to what classification needs. */
export interface ProbeResponse {
  status: number;
  /** Body size in bytes; undefined when it exceeded what was read and no Content-Length came. */
  length?: number;
  /** Location header resolved against the request URL. */
  location?: string;
  contentType?: string;
  /** First bytes of the body (only read for possible hits). */
  body?: string;
}

/** Statuses that mean "nothing here". */
const NOT_FOUND = new Set([400, 404, 410]);
const REDIRECT = new Set([301, 302, 303, 307, 308]);
const BACKUP_FILE =
  /\.(bak|old|orig|save|swp|tmp|zip|tar|tgz|gz|7z|rar|sql|dump|db|sqlite)$|~$/i;
export const MAX_HITS = 500;
const MAX_INFO_FINDINGS = 100;

/**
 * Base URL a scan runs below: origin + path as a directory (trailing slash added), without
 * query and fragment. https://x.test/app -> https://x.test/app/
 */
export function scanBase(target: string): string {
  const url = new URL(target);
  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return url.origin + path;
}

/** Every request path for one directory: each word bare and with each extension. */
export function candidates(
  words: readonly string[],
  extensions: readonly string[],
): string[] {
  return words.flatMap((w) => [w, ...extensions.map((e) => `${w}.${e}`)]);
}

/** Case-sensitive dedupe that keeps the first occurrence. */
export function uniqueWords(...lists: (readonly string[])[]): string[] {
  return [
    ...new Set(
      lists
        .flat()
        .map((w) => w.trim())
        .filter(Boolean),
    ),
  ];
}

/** The extension a candidate was built with ('' for a bare word). */
export function extensionOf(
  candidate: string,
  extensions: readonly string[],
): string {
  return extensions.find((e) => candidate.endsWith(`.${e}`)) ?? '';
}

/**
 * Location with the requested segment replaced, so redirects of a catch-all route compare
 * equal: /login?next=/abc and /login?next=/xyz both become /login?next=/{}.
 */
export function normalizeLocation(
  location: string | undefined,
  segment: string,
): string | undefined {
  if (!location) return undefined;
  return location.split(segment).join('{}');
}

function lengthClose(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) <= Math.max(32, 0.03 * Math.max(a, b));
}

/**
 * Whether a probe looks like the answer for a random, non-existing path (`baseline`): the
 * same status, the same redirect target, or about the same body size. That is how soft
 * 404s and catch-all routes (SPAs, login redirects) are filtered.
 */
export function matchesBaseline(
  probe: ProbeResponse,
  probeSegment: string,
  baseline: ProbeResponse | undefined,
  baselineSegment: string,
): boolean {
  if (!baseline || baseline.status !== probe.status) return false;
  if (REDIRECT.has(probe.status)) {
    return (
      normalizeLocation(probe.location, probeSegment) ===
      normalizeLocation(baseline.location, baselineSegment)
    );
  }
  return lengthClose(probe.length, baseline.length);
}

/** A baseline that is not a plain 404 means the directory answers every path. */
export function isWildcard(baseline: ProbeResponse | undefined): boolean {
  return !!baseline && !NOT_FOUND.has(baseline.status);
}

/** Whether a status alone rules a probe out (before reading its body). */
export function isNotFound(status: number): boolean {
  return NOT_FOUND.has(status);
}

export function extractTitle(body: string | undefined): string | undefined {
  const m = body ? /<title[^>]*>([^<]{1,300})<\/title>/i.exec(body) : null;
  const title = m?.[1]?.replace(/\s+/g, ' ').trim();
  return title ? title.slice(0, 120) : undefined;
}

/** Apache/nginx/IIS-style generated directory index. */
export function isDirectoryListing(body: string | undefined): boolean {
  if (!body) return false;
  return (
    /<title>\s*(Index of \/|Directory Listing For)/i.test(body) ||
    /<h1>\s*Index of \//i.test(body) ||
    /\[To Parent Directory\]/i.test(body)
  );
}

/**
 * Turns a probe into a hit (or null). `dirUrl` ends with '/', `candidate` is one segment.
 * A redirect to the same path plus '/' marks a directory.
 */
export function toHit(
  dirUrl: string,
  candidate: string,
  probe: ProbeResponse,
  depth: number,
): DirBusterHit | null {
  if (NOT_FOUND.has(probe.status)) return null;
  const url = dirUrl + candidate;
  const listing = isDirectoryListing(probe.body);
  const toSlash =
    REDIRECT.has(probe.status) &&
    !!probe.location &&
    new URL(probe.location).pathname === `${new URL(url).pathname}/`;
  const kind: DirBusterKind = toSlash || listing ? 'directory' : 'file';
  const finalUrl = kind === 'directory' ? `${url}/` : url;
  return {
    path: new URL(finalUrl).pathname,
    url: finalUrl,
    status: probe.status,
    kind,
    ...(probe.length !== undefined && { length: probe.length }),
    ...(probe.contentType && { contentType: probe.contentType }),
    ...(probe.location && !toSlash && { redirect: probe.location }),
    ...(extractTitle(probe.body) && { title: extractTitle(probe.body) }),
    ...(listing && { listing: true }),
    depth,
  };
}

/**
 * Directory listings and reachable backup/archive files are warnings; every other hit is
 * information (an inventory, not a vulnerability). Info findings are capped.
 */
export function dirBusterFindings(hits: DirBusterHit[]): Finding[] {
  const out: Finding[] = [];
  let info = 0;
  for (const h of hits) {
    if (h.listing) {
      out.push({
        id: `dir-buster.listing:${h.path}`,
        status: 'warn',
        title: 'Directory listing enabled',
        message: `${h.path} returns a generated index of its files. Disable autoindex/directory browsing unless it is intended.`,
        value: h.path,
      });
    } else if (h.status === 200 && BACKUP_FILE.test(h.path)) {
      out.push({
        id: `dir-buster.backup:${h.path}`,
        status: 'warn',
        title: 'Backup or archive file reachable',
        message: `${h.path} can be downloaded. Backups, dumps and archives often contain source code, credentials or data; remove them from the web root.`,
        value: h.path,
      });
    } else if (info < MAX_INFO_FINDINGS) {
      info++;
      out.push({
        id: `dir-buster.path:${h.path}`,
        status: 'info',
        title: h.kind === 'directory' ? 'Directory found' : 'Path found',
        message: `${h.path} answers HTTP ${h.status}${h.redirect ? ` (redirects to ${h.redirect})` : ''}.`,
        value: `${h.status} ${h.path}`,
      });
    }
  }
  return out;
}

/**
 * Replaces the redirect of a directory hit with what the directory URL itself answered
 * (status, title, listing), unless that is "not found".
 */
export function withDirectoryResponse(
  hit: DirBusterHit,
  dir: ProbeResponse,
): DirBusterHit {
  if (NOT_FOUND.has(dir.status)) return hit;
  const title = extractTitle(dir.body);
  const { length: _length, contentType: _type, title: _title, ...rest } = hit;
  return {
    ...rest,
    status: dir.status,
    ...(dir.length !== undefined && { length: dir.length }),
    ...(dir.contentType && { contentType: dir.contentType }),
    ...(dir.location && { redirect: dir.location }),
    ...(title && { title }),
    ...(isDirectoryListing(dir.body) && { listing: true }),
  };
}
