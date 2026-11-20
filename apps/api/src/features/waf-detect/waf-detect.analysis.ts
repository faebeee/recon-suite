import type { EdgeDetection, Finding, WafDetectOutput } from '@recon/shared';
import { kindsOf } from './waf-detect.signatures.js';

/** Joins baseline and probe matches; probe-only matches are flagged. */
export function mergeDetections(
  baseline: Map<string, string[]>,
  probe: Map<string, string[]> | undefined,
): EdgeDetection[] {
  const names = new Set([...baseline.keys(), ...(probe?.keys() ?? [])]);
  return [...names].map((name) => ({
    name,
    kinds: kindsOf(name),
    evidence: [
      ...new Set([...(baseline.get(name) ?? []), ...(probe?.get(name) ?? [])]),
    ],
    probeOnly: !baseline.has(name),
  }));
}

/** A trigger request answered with an error while the plain one was fine. */
export function isBlocked(
  baselineStatus: number | undefined,
  probe: { status?: number; error?: string },
): boolean {
  if (baselineStatus === undefined || baselineStatus >= 400) return false;
  if (probe.error) return true; // connection reset: some WAFs drop the request
  return probe.status !== undefined && probe.status >= 400;
}

export function wafFindings(o: Omit<WafDetectOutput, 'findings'>): Finding[] {
  const out: Finding[] = o.detections.map((d) => ({
    id: `edge.${d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    status: 'info',
    title: `${d.name} (${d.kinds.join(', ')})`,
    message: d.probeOnly
      ? 'Recognised from the answer to the trigger request (block page).'
      : 'Recognised from the normal response.',
    value: d.evidence.join('; '),
  }));
  if (!o.detections.length) {
    out.push({
      id: 'edge.none',
      status: 'info',
      title: 'No CDN or WAF recognised',
      message:
        'No known edge fingerprint. The origin may be exposed directly, or the edge hides its markers.',
    });
  }
  if (o.probe) {
    const hasWaf = o.detections.some((d) => d.kinds.includes('waf'));
    out.push(
      o.probe.blocked
        ? {
            id: 'waf.blocks',
            status: 'pass',
            title: 'Attack-looking request blocked',
            message: o.probe.error
              ? `The connection was dropped (${o.probe.error}) while the normal request worked.`
              : `Answered ${o.probe.status} while the normal request got ${o.baseline.status}${hasWaf ? '' : '; something filters requests even though no WAF product was recognised'}.`,
          }
        : {
            id: 'waf.blocks',
            status: 'info',
            title: 'Attack-looking request not blocked',
            message: `Answered ${o.probe.status ?? '-'} like a normal request: no WAF rejects obvious SQL injection, XSS or path traversal strings here.`,
          },
    );
  }
  return out;
}
