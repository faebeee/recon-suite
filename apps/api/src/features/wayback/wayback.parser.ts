import type { ArchivedUrl, InterestingUrl, WaybackOutput } from '@recon/shared';

export const MAX_INTERESTING = 500;
export const MAX_PARAMETERS = 100;
export const MAX_EXTENSIONS = 100;

/**
 * Parses the CDX JSON (`output=json`): an array of string rows whose first row is the
 * header (`original, timestamp, statuscode, mimetype`). An empty result is `[]`.
 */
export function parseCdxRows(json: unknown): string[][] {
  if (!Array.isArray(json)) throw new Error('Unexpected archive response');
  const rows = json.filter(
    (r): r is string[] =>
      Array.isArray(r) && r.every((c) => typeof c === 'string'),
  );
  if (rows[0]?.[0] === 'original') rows.shift();
  return rows;
}

/** CDX timestamp (yyyyMMddhhmmss, possibly shorter) -> ISO string. */
export function cdxTimestampToIso(ts: string): string {
  const m = /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(ts);
  if (!m) return ts;
  const [, y, mo = '01', d = '01', h = '00', mi = '00', s = '00'] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  return Number.isNaN(Date.parse(iso)) ? ts : new Date(iso).toISOString();
}

export function toArchivedUrls(rows: string[][]): ArchivedUrl[] {
  const byUrl = new Map<string, ArchivedUrl>();
  for (const [original, timestamp = '', status, mime] of rows) {
    if (!original) continue;
    const entry: ArchivedUrl = {
      url: original,
      lastSeen: cdxTimestampToIso(timestamp),
    };
    const code = Number(status);
    if (status && /^\d{3}$/.test(status)) entry.status = code;
    if (mime && mime !== 'unk' && mime !== '-') entry.mimeType = mime;
    const prev = byUrl.get(original);
    if (!prev || prev.lastSeen < entry.lastSeen) byUrl.set(original, entry);
  }
  return [...byUrl.values()];
}

const BACKUP_EXT =
  /\.(bak|old|orig|backup|swp|zip|tar|tar\.gz|tgz|rar|7z|sql|db|sqlite)$|~$/i;
const SECRET_EXT = /\.(log|key|pem|env)$|(^|\/)\.env(\.[\w-]+)?$/i;
const CONFIG_EXT = /\.(config|conf|ini|ya?ml)$/i;
/** JSON counts only below config-ish paths or with a config-ish name (APIs serve lots of JSON). */
const CONFIG_DATA =
  /\/(config|configs|conf|settings|\.?secrets?)\/[^?#]*\.json$|\/(app)?(config|settings|secrets?|credentials)[\w.-]*\.json$/i;
const SENSITIVE_KEYS = new Set([
  'token',
  'key',
  'api_key',
  'apikey',
  'secret',
  'password',
  'passwd',
  'pwd',
  'auth',
  'session',
  'sid',
  'access_token',
  'signature',
]);
const ADMIN_PATH =
  /(^|\/)(admin|wp-admin|debug|console|internal|graphql|swagger|actuator|\.git|phpmyadmin)(\/|$|\.|-|_)/i;

function parse(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/** Returns why a URL is worth a manual look, or undefined. */
export function interestingReason(url: string): string | undefined {
  const u = parse(url);
  if (!u) return undefined;
  const path = decodeSafe(u.pathname);
  if (BACKUP_EXT.test(path)) return 'backup file';
  if (SECRET_EXT.test(path))
    return path.endsWith('.log') ? 'log file' : 'secret file';
  if (CONFIG_EXT.test(path) || CONFIG_DATA.test(path)) return 'config file';
  for (const key of u.searchParams.keys()) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()))
      return `${key.toLowerCase()} in query`;
  }
  if (ADMIN_PATH.test(path)) return 'admin/debug path';
  return undefined;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Lowercased file extension of the last path segment, e.g. "php", "tar.gz". */
export function extensionOf(url: string): string | undefined {
  const u = parse(url);
  if (!u) return undefined;
  const last = u.pathname.split('/').pop() ?? '';
  if (/\.tar\.gz$/i.test(last)) return 'tar.gz';
  const m = /\.([a-z0-9]{1,8})$/i.exec(last);
  return m ? m[1]!.toLowerCase() : undefined;
}

function top<T extends string>(
  counts: Map<T, number>,
  limit: number,
): [T, number][] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

export function analyzeWayback(
  domain: string,
  rows: string[][],
  limit: number,
): WaybackOutput {
  const urls = toArchivedUrls(rows);
  const interesting: InterestingUrl[] = [];
  const params = new Map<string, number>();
  const exts = new Map<string, number>();

  for (const { url } of urls) {
    const reason = interestingReason(url);
    if (reason && interesting.length < MAX_INTERESTING) {
      interesting.push({ url, reason });
    }
    const u = parse(url);
    if (u) {
      for (const name of new Set(u.searchParams.keys())) {
        if (name) params.set(name, (params.get(name) ?? 0) + 1);
      }
    }
    const ext = extensionOf(url);
    if (ext) exts.set(ext, (exts.get(ext) ?? 0) + 1);
  }

  return {
    domain,
    source: 'web.archive.org',
    total: urls.length,
    truncated: rows.length >= limit,
    urls,
    interesting,
    parameters: top(params, MAX_PARAMETERS).map(([name, count]) => ({
      name,
      count,
    })),
    extensions: top(exts, MAX_EXTENSIONS).map(([ext, count]) => ({
      ext,
      count,
    })),
  };
}
