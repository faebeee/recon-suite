import { Injectable } from '@nestjs/common';
import {
  MAX_FAVICONS,
  type FaviconHashOutput,
  type FaviconHashParams,
  type FaviconResult,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextPrefix } from '../../core/http/read-limited.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import { digests, shodanFaviconHash } from './favicon-hash.hash.js';
import {
  decodeDataUrl,
  looksLikeImage,
  parseIconLinks,
} from './favicon-hash.parser.js';

const TIMEOUT_MS = 10_000;
const PAGE_BYTES = 512 * 1024;
const ICON_BYTES = 1024 * 1024;

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

@Injectable()
export class FaviconHashService {
  constructor(private readonly http: HttpClientService) {}

  async hash({ target }: FaviconHashParams): Promise<FaviconHashOutput> {
    const { res, finalUrl } = await this.http.targetFollow(target, {
      maxRedirects: 5,
      timeoutMs: TIMEOUT_MS,
    });
    const { text } = await readTextPrefix(res, PAGE_BYTES);
    const fallback = new URL('/favicon.ico', finalUrl).href;
    const links = parseIconLinks(text, finalUrl).filter((u) => u !== fallback);

    type Candidate = { url: string; source: FaviconResult['source'] };
    const candidates: Candidate[] = [
      { url: fallback, source: 'default' } satisfies Candidate,
      ...links.map((url): Candidate => ({ url, source: 'link' })),
    ].slice(0, MAX_FAVICONS);

    const icons = await mapConcurrent(candidates, 3, (c) =>
      this.fetchIcon(c.url, c.source),
    );
    return { page: finalUrl, icons };
  }

  private async fetchIcon(
    url: string,
    source: FaviconResult['source'],
  ): Promise<FaviconResult> {
    const inline = url.startsWith('data:') ? decodeDataUrl(url) : null;
    if (url.startsWith('data:')) {
      const shown = `${url.slice(0, 48)}…`;
      return inline
        ? describe(shown, source, inline.bytes, inline.contentType)
        : { url: shown, source, error: 'Inline icon is not base64-encoded' };
    }
    try {
      const { res, finalUrl } = await this.http.targetFollow(url, {
        maxRedirects: 3,
        timeoutMs: TIMEOUT_MS,
      });
      const contentType = res.headers.get('content-type') ?? undefined;
      if (!res.ok) {
        await res.body?.cancel();
        return {
          url: finalUrl,
          source,
          status: res.status,
          error: `HTTP ${res.status}`,
        };
      }
      const { bytes, truncated } = await readBytes(res.body, ICON_BYTES);
      if (truncated) {
        return {
          url: finalUrl,
          source,
          status: res.status,
          error: 'Larger than 1 MB',
        };
      }
      return {
        ...describe(finalUrl, source, bytes, contentType),
        status: res.status,
      };
    } catch (err) {
      return { url, source, error: message(err) };
    }
  }
}

function describe(
  url: string,
  source: FaviconResult['source'],
  bytes: Uint8Array,
  contentType?: string,
): FaviconResult {
  const base = {
    url,
    source,
    bytes: bytes.length,
    ...(contentType && { contentType }),
  };
  if (!looksLikeImage(bytes, contentType)) {
    return { ...base, error: 'Not an image (probably a catch-all page)' };
  }
  const mmh3 = shodanFaviconHash(bytes);
  const { md5, sha256 } = digests(bytes);
  return {
    ...base,
    mmh3,
    md5,
    sha256,
    queries: [
      { engine: 'Shodan', query: `http.favicon.hash:${mmh3}` },
      { engine: 'FOFA', query: `icon_hash="${mmh3}"` },
      {
        engine: 'Censys',
        query: `services.http.response.favicons.md5_hash: ${md5}`,
      },
    ],
  };
}

/** Reads a body as bytes up to `max`; the rest is cancelled. */
async function readBytes(
  body: AsyncIterable<Uint8Array> | null,
  max: number,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!body) return { bytes: new Uint8Array(), truncated: false };
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > max) return { bytes: new Uint8Array(), truncated: true };
    chunks.push(chunk);
  }
  return { bytes: Buffer.concat(chunks), truncated: false };
}
