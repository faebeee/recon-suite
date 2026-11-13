import { Injectable } from '@nestjs/common';
import type {
  WebFileFetch,
  WebFileName,
  WebFilesOutput,
  WebFilesParams,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextLimited } from '../../core/http/read-limited.js';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
import {
  isSoft404,
  parseRobots,
  parseSecurityTxt,
  parseSitemap,
} from './web-files.parser.js';

const LIMITS: Record<WebFileName, number> = {
  'robots.txt': 512 * 1024,
  'sitemap.xml': 2 * 1024 * 1024,
  'security.txt': 64 * 1024,
  'humans.txt': 64 * 1024,
};
const HUMANS_PREVIEW = 2000;

interface Fetched {
  meta: WebFileFetch;
  text?: string;
}

@Injectable()
export class WebFilesService {
  constructor(
    private readonly http: HttpClientService,
    private readonly guard: TargetGuardService,
  ) {}

  async fetch({ target }: WebFilesParams): Promise<WebFilesOutput> {
    const origin = new URL(target).origin;
    // Fail fast with 403/404 for blocked or unresolvable targets instead of per-file errors.
    // Every request below is still guarded on its own (redirects, DNS rebinding).
    await this.guard.resolve(new URL(origin).hostname.replace(/^\[|\]$/g, ''));

    const [robots, sitemap, security, humans] = await Promise.all([
      this.get(origin, 'robots.txt', '/robots.txt'),
      this.get(origin, 'sitemap.xml', '/sitemap.xml'),
      this.get(origin, 'security.txt', '/.well-known/security.txt').then((r) =>
        r.text !== undefined
          ? r
          : this.get(origin, 'security.txt', '/security.txt'),
      ),
      this.get(origin, 'humans.txt', '/humans.txt'),
    ]);

    const out: WebFilesOutput = {
      origin,
      files: [robots.meta, sitemap.meta, security.meta, humans.meta],
    };

    if (robots.text !== undefined) out.robots = parseRobots(robots.text);

    // Fall back to the first sitemap declared in robots.txt (same origin only).
    let sitemapDoc = sitemap;
    const declared = out.robots?.sitemaps.find((s) => sameOrigin(s, origin));
    if (
      sitemap.text === undefined &&
      declared &&
      declared !== sitemap.meta.url
    ) {
      const path = new URL(declared);
      sitemapDoc = await this.get(
        origin,
        'sitemap.xml',
        path.pathname + path.search,
      );
      out.files[1] = sitemapDoc.meta;
    }
    if (sitemapDoc.text !== undefined) {
      out.sitemap = parseSitemap(
        sitemapDoc.meta.finalUrl ?? sitemapDoc.meta.url,
        sitemapDoc.text,
      );
    }

    if (security.text !== undefined) {
      out.securityTxt = parseSecurityTxt(
        security.text,
        security.meta.finalUrl ?? security.meta.url,
      );
    }
    if (humans.text !== undefined) {
      out.humans = {
        preview: humans.text.slice(0, HUMANS_PREVIEW),
        truncated: humans.text.length > HUMANS_PREVIEW,
      };
    }
    return out;
  }

  /** Fetches one file; never throws, errors end up in `meta.error`. */
  private async get(
    origin: string,
    file: WebFileName,
    path: string,
  ): Promise<Fetched> {
    const url = origin + path;
    const meta: WebFileFetch = { file, url, found: false };
    try {
      const { res, finalUrl } = await this.http.targetFollow(url, {
        timeoutMs: 10_000,
        maxRedirects: 5,
      });
      meta.finalUrl = finalUrl;
      meta.status = res.status;
      meta.contentType = res.headers.get('content-type') ?? undefined;
      if (!res.ok) {
        await res.body?.cancel();
        return { meta };
      }
      // An HTML page where a text/XML file was expected: no need to download it.
      if (meta.contentType?.includes('text/html')) {
        await res.body?.cancel();
        meta.soft404 = true;
        return { meta };
      }
      const text = await readTextLimited(res, LIMITS[file]);
      meta.bytes = Buffer.byteLength(text);
      if (isSoft404(meta.contentType, text)) {
        meta.soft404 = true;
        return { meta };
      }
      meta.found = true;
      return { meta, text };
    } catch (err) {
      meta.error = err instanceof Error ? err.message : String(err);
      return { meta };
    }
  }
}

function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}
