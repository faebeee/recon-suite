import { Injectable } from '@nestjs/common';
import type {
  ApiDiscoveryOutput,
  ApiDiscoveryParams,
  ApiProbe,
  ApiSpec,
  GraphqlEndpoint,
} from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextPrefix } from '../../core/http/read-limited.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import {
  apiFindings,
  dedupeSpecs,
  INTROSPECTION_QUERY,
  isDocPage,
  parseGraphql,
  parseSpec,
  PROBE_PATHS,
  type ProbePath,
} from './api-discovery.parser.js';

const TIMEOUT_MS = 8000;
const BODY_BYTES = 2 * 1024 * 1024;

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

type Hit =
  | { type: 'spec'; spec: ApiSpec }
  | { type: 'page'; url: string }
  | { type: 'graphql'; endpoint: GraphqlEndpoint };

@Injectable()
export class ApiDiscoveryService {
  constructor(private readonly http: HttpClientService) {}

  async discover({ target }: ApiDiscoveryParams): Promise<ApiDiscoveryOutput> {
    // Resolve redirects once (e.g. http -> https, apex -> www); probes use the final origin.
    const { res, finalUrl } = await this.http.targetFollow(target, {
      maxRedirects: 5,
      timeoutMs: TIMEOUT_MS,
    });
    await res.body?.cancel();
    const origin = new URL(finalUrl).origin;
    const jobs = probeBases(finalUrl).flatMap((base) =>
      PROBE_PATHS.map((p) => ({ base, p })),
    );

    const results = await mapConcurrent(jobs, 4, ({ base, p }) =>
      this.probe(base, p),
    );
    const hits = results.flatMap((r) => (r.hit ? [r.hit] : []));
    const specs = dedupeSpecs(
      hits.flatMap((h) => (h.type === 'spec' ? [h.spec] : [])),
    );
    const docPages = hits.flatMap((h) => (h.type === 'page' ? [h.url] : []));
    const graphql = hits.flatMap((h) =>
      h.type === 'graphql' ? [h.endpoint] : [],
    );
    return {
      origin,
      specs,
      docPages,
      graphql,
      probes: results.map((r) => r.probe),
      findings: apiFindings({ specs, docPages, graphql }),
    };
  }

  /** One location; never throws. Redirects count as "not here". */
  private async probe(
    base: string,
    { path: suffix, kind }: ProbePath,
  ): Promise<{ probe: ApiProbe; hit?: Hit }> {
    const url = `${base}${suffix}`;
    const path = new URL(url).pathname;
    try {
      const res = await this.http.target(url, {
        redirect: 'manual',
        timeoutMs: TIMEOUT_MS,
        ...(kind === 'graphql' && {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: INTROSPECTION_QUERY,
        }),
      });
      // GraphQL servers often answer 400 with an error body; everything else needs a 200.
      if (res.status !== 200 && !(kind === 'graphql' && res.status === 400)) {
        await res.body?.cancel();
        return { probe: { path, kind, status: res.status, found: false } };
      }
      const { text } = await readTextPrefix(res, BODY_BYTES);
      const hit = classify(url, kind, text);
      return {
        probe: { path, kind, status: res.status, found: !!hit },
        ...(hit && { hit }),
      };
    } catch (err) {
      return { probe: { path, kind, found: false, error: message(err) } };
    }
  }
}

/**
 * The origin, plus the URL's directory when it has one (https://x/v2 also probes
 * /v2/swagger.json), because APIs are often mounted below a prefix.
 */
export function probeBases(url: string): string[] {
  const u = new URL(url);
  const dir = u.pathname.replace(/\/+$/, '');
  return dir ? [u.origin, `${u.origin}${dir}`] : [u.origin];
}

function classify(
  url: string,
  kind: ProbePath['kind'],
  body: string,
): Hit | undefined {
  if (kind === 'openapi') {
    const spec = parseSpec(url, body);
    return spec ? { type: 'spec', spec } : undefined;
  }
  if (kind === 'graphql') {
    const endpoint = parseGraphql(url, body);
    return endpoint ? { type: 'graphql', endpoint } : undefined;
  }
  return isDocPage(kind, body) ? { type: 'page', url } : undefined;
}
