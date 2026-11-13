import { Injectable } from '@nestjs/common';
import type {
  JsEndpointsOutput,
  JsEndpointsParams,
  JsScript,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextPrefix } from '../../core/http/read-limited.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import {
  analyseSource,
  extractPageScripts,
  findSourceMap,
  isSameSite,
  jsFindings,
  mergeResults,
  type AnalysedSource,
} from './js-endpoints.parser.js';

const PAGE_LIMIT = 2 * 1024 * 1024;
const SCRIPT_LIMIT = 5 * 1024 * 1024;
const SCRIPT_TIMEOUT_MS = 10_000;
const MAP_TIMEOUT_MS = 8000;

@Injectable()
export class JsEndpointsService {
  constructor(private readonly http: HttpClientService) {}

  async analyse({
    target,
    maxScripts,
  }: JsEndpointsParams): Promise<JsEndpointsOutput> {
    const { res, finalUrl } = await this.http.targetFollow(target, {
      maxRedirects: 5,
      timeoutMs: SCRIPT_TIMEOUT_MS,
    });
    const { text: html } = await readTextPrefix(res, PAGE_LIMIT);
    const pageHost = new URL(finalUrl).hostname;
    const { urls, inline } = extractPageScripts(html, finalUrl);

    const results: AnalysedSource[] = inline.map((code, i) =>
      analyseSource(code, `${finalUrl} (inline #${i + 1})`),
    );

    let budget = maxScripts;
    const scripts: JsScript[] = urls.map((url) => {
      const external = !isSameSite(url, pageHost);
      if (external) return { url, external };
      if (budget-- > 0) return { url, external };
      return { url, external, error: 'Not downloaded (script limit reached)' };
    });

    const toFetch = scripts.filter((s) => !s.external && !s.error);
    const analysed = await mapConcurrent(toFetch, 4, (s) =>
      this.fetchScript(s, pageHost),
    );
    for (const a of analysed) if (a) results.push(a);

    const { endpoints, hosts, secrets } = mergeResults(results);
    return {
      page: finalUrl,
      scripts,
      endpoints,
      hosts,
      secrets,
      findings: jsFindings(scripts, endpoints, secrets),
    };
  }

  /** Downloads and analyses one same-site script, filling `script` in place. Never throws. */
  private async fetchScript(
    script: JsScript,
    pageHost: string,
  ): Promise<AnalysedSource | undefined> {
    try {
      const { res } = await this.http.targetFollow(script.url, {
        maxRedirects: 5,
        timeoutMs: SCRIPT_TIMEOUT_MS,
      });
      script.status = res.status;
      if (!res.ok) {
        await res.body?.cancel();
        return undefined;
      }
      const { text, truncated } = await readTextPrefix(res, SCRIPT_LIMIT);
      script.bytes = Buffer.byteLength(text);
      if (truncated) script.truncated = true;

      const map = findSourceMap(text, script.url);
      if (map) {
        script.sourceMap = map;
        if (isSameSite(map, pageHost)) {
          script.sourceMapExposed = await this.isReachable(map);
        }
      }
      return analyseSource(text, script.url);
    } catch (err) {
      script.error = err instanceof Error ? err.message : String(err);
      return undefined;
    }
  }

  /** HEAD (or GET + cancel when HEAD is not allowed) answers 200. */
  private async isReachable(url: string): Promise<boolean> {
    try {
      let res = await this.http.target(url, {
        method: 'HEAD',
        redirect: 'manual',
        timeoutMs: MAP_TIMEOUT_MS,
      });
      await res.body?.cancel();
      if (res.status === 405) {
        res = await this.http.target(url, {
          redirect: 'manual',
          timeoutMs: MAP_TIMEOUT_MS,
        });
        await res.body?.cancel();
      }
      return res.status === 200;
    } catch {
      return false;
    }
  }
}
