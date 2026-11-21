import { isIP } from 'node:net';
import type { Finding, GobusterHit } from '@recon/shared';

export const GOBUSTER_REQUEST_TIMEOUT = '10s';
const MAX_HITS = 1000;
const MAX_INFO_FINDINGS = 100;
const BACKUP_FILE =
  /\.(bak|old|orig|save|swp|tmp|zip|tar|tgz|gz|7z|rar|sql|dump|db|sqlite)$|~$/i;

/**
 * Where gobuster connects: the target URL with its host replaced by the guard-resolved IP,
 * plus the Host header that keeps virtual hosting working. HTTPS needs certificate checks
 * off, because the certificate names the hostname, not the IP.
 */
export function connectTarget(
  target: string,
  address: string,
): { url: string; host: string; insecure: boolean; base: string } {
  const original = new URL(target);
  const path = original.pathname.endsWith('/')
    ? original.pathname
    : `${original.pathname}/`;
  const base = original.origin + path;
  const ipHost = isIP(address) === 6 ? `[${address}]` : address;
  const url = `${original.protocol}//${ipHost}${original.port ? `:${original.port}` : ''}${path}`;
  return {
    url,
    host: original.host,
    insecure: original.protocol === 'https:',
    base,
  };
}

export interface GobusterArgs {
  url: string;
  host: string;
  insecure: boolean;
  wordlistPath: string;
  extensions: readonly string[];
  threads: number;
  excludeLengths: readonly number[];
}

/** Fixed argument list for `gobuster dir`; every variable part is validated beforehand. */
export function buildGobusterArgs(a: GobusterArgs): string[] {
  return [
    'dir',
    '--url',
    a.url,
    '--wordlist',
    a.wordlistPath,
    '--threads',
    String(a.threads),
    '--timeout',
    GOBUSTER_REQUEST_TIMEOUT,
    '--headers',
    `Host: ${a.host}`,
    '--quiet',
    '--no-progress',
    '--no-color',
    '--no-error',
    ...(a.insecure ? ['--no-tls-validation'] : []),
    ...(a.extensions.length ? ['--extensions', a.extensions.join(',')] : []),
    ...(a.excludeLengths.length
      ? ['--exclude-length', a.excludeLengths.join(',')]
      : []),
  ];
}

/** Colour codes, in case a gobuster version ignores --no-color. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');
const HIT_LINE =
  /^(\S+)\s+\(Status:\s*(\d{3})\)(?:\s+\[Size:\s*(\d+)\])?(?:\s+\[-->\s*(.+?)\])?\s*$/;

/**
 * Parses gobuster's result lines, e.g.
 *   /admin                (Status: 301) [Size: 178] [--> http://192.0.2.1/admin/]
 * Paths are relative to the scanned base; redirect targets that point at the IP are shown
 * with the original host again. Other lines (banners, warnings) are ignored.
 */
export function parseGobusterOutput(
  stdout: string,
  base: string,
  connectUrl: string,
): GobusterHit[] {
  const baseUrl = new URL(base);
  const ipOrigin = new URL(connectUrl).origin;
  const hits = new Map<string, GobusterHit>();
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.replace(ANSI, '').trim();
    const m = HIT_LINE.exec(line);
    if (!m) continue;
    const word = m[1]!.replace(/^\/+/, '');
    const url = new URL(word, baseUrl).href;
    const path = new URL(url).pathname;
    if (hits.has(path) || hits.size >= MAX_HITS) continue;
    const redirect = m[4]?.trim();
    hits.set(path, {
      path,
      url,
      status: Number(m[2]),
      ...(m[3] && { length: Number(m[3]) }),
      ...(redirect && {
        redirect: redirect.startsWith(ipOrigin)
          ? baseUrl.origin + redirect.slice(ipOrigin.length)
          : redirect,
      }),
    });
  }
  return [...hits.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * gobuster refuses to scan when random paths don't answer 404. Returns a message that says
 * what to exclude, or undefined for other errors.
 */
export function wildcardHint(stderr: string): string | undefined {
  if (!/matches the provided options for non existing urls/i.test(stderr)) {
    return undefined;
  }
  const status = /=>\s*(\d{3})/.exec(stderr)?.[1];
  const length = /\(Length:\s*(\d+)\)/i.exec(stderr)?.[1];
  return (
    `The server answers paths that don't exist with ${status ? `HTTP ${status}` : 'a non-404 status'}` +
    `${length ? ` and a ${length}-byte page` : ''}, so gobuster can't tell hits apart.` +
    (length
      ? ` Add ${length} to "Exclude lengths" and run it again, or use Dir Buster, which filters these responses itself.`
      : ' Use Dir Buster, which filters these responses itself.')
  );
}

/** Backups and archives are warnings; everything else is an inventory entry (capped). */
export function gobusterFindings(hits: GobusterHit[]): Finding[] {
  const out: Finding[] = [];
  let info = 0;
  for (const h of hits) {
    if (h.status === 200 && BACKUP_FILE.test(h.path)) {
      out.push({
        id: `gobuster.backup:${h.path}`,
        status: 'warn',
        title: 'Backup or archive file reachable',
        message: `${h.path} can be downloaded. Backups, dumps and archives often contain source code, credentials or data; remove them from the web root.`,
        value: h.path,
      });
    } else if (info < MAX_INFO_FINDINGS) {
      info++;
      out.push({
        id: `gobuster.path:${h.path}`,
        status: 'info',
        title: 'Path found',
        message: `${h.path} answers HTTP ${h.status}${h.redirect ? ` (redirects to ${h.redirect})` : ''}.`,
        value: `${h.status} ${h.path}`,
      });
    }
  }
  return out;
}
