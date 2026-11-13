import { Injectable } from '@nestjs/common';
import type {
  TechFingerprintOutput,
  TechFingerprintParams,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextPrefix } from '../../core/http/read-limited.js';
import { detectTechnologies, extractTitle } from './fingerprint.js';

/** Markers live in <head> and early <body>; 1 MB covers practically every page. */
const MAX_HTML_BYTES = 1024 * 1024;

@Injectable()
export class TechFingerprintService {
  constructor(private readonly http: HttpClientService) {}

  async fingerprint({
    target,
  }: TechFingerprintParams): Promise<TechFingerprintOutput> {
    const { res, finalUrl, redirects } = await this.http.targetFollow(target, {
      timeoutMs: 12_000,
      maxRedirects: 8,
      headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
    });

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const cookieNames = res.headers
      .getSetCookie()
      .map((c) => c.split('=')[0]!.trim())
      .filter(Boolean);

    const contentType = headers['content-type'] ?? '';
    let html = '';
    let truncated = false;
    if (!contentType || /html|xml/i.test(contentType)) {
      ({ text: html, truncated } = await readTextPrefix(res, MAX_HTML_BYTES));
    } else {
      await res.body?.cancel();
    }

    return {
      finalUrl,
      status: res.status,
      redirects,
      title: extractTitle(html),
      truncated,
      technologies: detectTechnologies({ headers, cookieNames, html }),
    };
  }
}
