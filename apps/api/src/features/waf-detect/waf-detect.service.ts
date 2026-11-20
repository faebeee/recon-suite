import { Injectable } from '@nestjs/common';
import type {
  WafDetectOutput,
  WafDetectParams,
  WafResponse,
} from '@recon/shared';
import type { Response } from 'undici';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextPrefix } from '../../core/http/read-limited.js';
import {
  isBlocked,
  mergeDetections,
  wafFindings,
} from './waf-detect.analysis.js';
import {
  cookieNames,
  matchSignatures,
  TRIGGER_QUERY,
  type ResponseView,
} from './waf-detect.signatures.js';

const TIMEOUT_MS = 10_000;
const BODY_BYTES = 128 * 1024;

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

@Injectable()
export class WafDetectService {
  constructor(private readonly http: HttpClientService) {}

  async detect({ target, probe }: WafDetectParams): Promise<WafDetectOutput> {
    const { res, finalUrl } = await this.http.targetFollow(target, {
      maxRedirects: 5,
      timeoutMs: TIMEOUT_MS,
    });
    const baselineView = await view(res);
    const baseline: WafResponse = {
      url: finalUrl,
      status: res.status,
      ...(res.headers.get('server') && { server: res.headers.get('server')! }),
    };

    let probeOut: WafDetectOutput['probe'];
    let probeMatches: Map<string, string[]> | undefined;
    if (probe) {
      const url = new URL(finalUrl);
      url.search = url.search
        ? `${url.search}&${TRIGGER_QUERY}`
        : TRIGGER_QUERY;
      try {
        const p = await this.http.target(url.href, {
          redirect: 'manual',
          timeoutMs: TIMEOUT_MS,
        });
        probeMatches = matchSignatures(await view(p));
        const server = p.headers.get('server');
        probeOut = {
          url: url.href,
          status: p.status,
          ...(server && { server }),
          blocked: isBlocked(res.status, { status: p.status }),
        };
      } catch (err) {
        const error = message(err);
        probeOut = {
          url: url.href,
          error,
          blocked: isBlocked(res.status, { error }),
        };
      }
    }

    const result = {
      finalUrl,
      baseline,
      ...(probeOut && { probe: probeOut }),
      detections: mergeDetections(matchSignatures(baselineView), probeMatches),
    };
    return { ...result, findings: wafFindings(result) };
  }
}

async function view(res: Response): Promise<ResponseView> {
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  const { text } = await readTextPrefix(res, BODY_BYTES);
  return {
    headers,
    cookies: cookieNames(res.headers.getSetCookie()),
    body: text,
  };
}
