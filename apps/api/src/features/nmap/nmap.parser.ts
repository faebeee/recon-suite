import type { Finding, NmapOutput, NmapPort } from '@recon/shared';
import {
  decodeXmlEntities as decode,
  xmlAttrs as attrs,
} from '../../core/util/xml-attrs.js';

export interface NmapArgsOptions {
  /** Resolved and guard-checked IP literal. Never a hostname. */
  address: string;
  family: 4 | 6;
  topPorts: number;
  ports?: number[];
  serviceDetection: boolean;
}

/**
 * Fixed nmap flags. -sT works without raw sockets (same result as root or not),
 * -Pn skips host discovery (many hosts drop ICMP), -n disables reverse DNS so nmap does no
 * lookups of its own, --open keeps the output to open ports. No NSE scripts and no
 * --host-timeout: the scan runs until nmap is done.
 */
export function buildNmapArgs(o: NmapArgsOptions): string[] {
  const portArgs = o.ports?.length
    ? ['-p', [...new Set(o.ports)].sort((a, b) => a - b).join(',')]
    : ['--top-ports', String(o.topPorts)];
  return [
    '-sT',
    '-Pn',
    '-n',
    '--open',
    '-T4',
    '--max-retries',
    '2',
    ...(o.serviceDetection ? ['-sV', '--version-intensity', '5'] : []),
    ...(o.family === 6 ? ['-6'] : []),
    ...portArgs,
    '-oX',
    '-',
    o.address,
  ];
}

export type ParsedNmap = Pick<
  NmapOutput,
  'hostState' | 'ports' | 'scannedPorts' | 'nmapVersion' | 'elapsedSeconds'
>;

/** Parses nmap's XML output (`-oX -`) for a single-host scan. */
export function parseNmapXml(xml: string): ParsedNmap {
  const run = attrs(/<nmaprun\b([^>]*)>/.exec(xml)?.[1]);
  const finished = attrs(/<finished\b([^>]*?)\/?>/.exec(xml)?.[1]);
  const status = attrs(/<status\b([^>]*?)\/?>/.exec(xml)?.[1]);

  let scannedPorts = 0;
  for (const m of xml.matchAll(/<scaninfo\b([^>]*?)\/?>/g)) {
    scannedPorts += Number(attrs(m[1]).numservices ?? 0) || 0;
  }

  const ports: NmapPort[] = [];
  for (const m of xml.matchAll(/<port\b([^>]*)>([\s\S]*?)<\/port>/g)) {
    const portAttrs = attrs(m[1]);
    const body = m[2] ?? '';
    const state = attrs(/<state\b([^>]*?)\/?>/.exec(body)?.[1]);
    const service = attrs(/<service\b([^>]*?)\/?>/.exec(body)?.[1]);
    const port = Number(portAttrs.portid);
    if (!Number.isInteger(port)) continue;
    ports.push({
      port,
      protocol: portAttrs.protocol ?? 'tcp',
      state: state.state ?? 'unknown',
      reason: state.reason,
      service: service.name,
      product: service.product,
      version: service.version,
      extraInfo: service.extrainfo,
      method: service.method,
      cpe: [...body.matchAll(/<cpe>([^<]*)<\/cpe>/g)].map((c) =>
        decode(c[1] ?? ''),
      ),
    });
  }
  ports.sort((a, b) => a.port - b.port);

  const hostState =
    status.state === 'up' || status.state === 'down' ? status.state : 'unknown';
  const elapsed = Number(finished.elapsed);
  return {
    hostState,
    ports,
    scannedPorts,
    nmapVersion: run.version,
    elapsedSeconds: Number.isFinite(elapsed) ? elapsed : undefined,
  };
}

/** One info finding per open port, so engagements keep the service inventory. */
export function nmapFindings(ports: NmapPort[]): Finding[] {
  return ports.map((p) => {
    const product = [p.product, p.version].filter(Boolean).join(' ');
    return {
      id: `nmap.${p.protocol}.${p.port}`,
      status: 'info',
      title: `${p.port}/${p.protocol} open${p.service ? ` (${p.service})` : ''}`,
      message: product
        ? `${product}${p.extraInfo ? ` (${p.extraInfo})` : ''}`
        : 'Open port; no version information.',
      value: product || p.service,
    };
  });
}
