import type {
  ExposureAddress,
  Finding,
  FindingStatus,
  RiskyPort,
} from '@recon/shared';

/** Caps on what a (third-party) response may put into our output. */
const MAX_PORTS = 1000;
const MAX_ITEMS = 200;

/** Raw InternetDB answer: https://internetdb.shodan.io/<ip> */
export interface InternetDbData {
  ports: number[];
  cpes: string[];
  hostnames: string[];
  tags: string[];
  vulns: string[];
}

const strings = (v: unknown, max = MAX_ITEMS) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string' && x.length <= 300)
        .slice(0, max)
    : [];

/** Validates and bounds an InternetDB response; undefined when it is not one. */
export function parseInternetDb(json: unknown): InternetDbData | undefined {
  if (!json || typeof json !== 'object' || !('ports' in json)) return undefined;
  const o = json as Record<string, unknown>;
  const ports = Array.isArray(o.ports)
    ? [
        ...new Set(
          o.ports.filter(
            (p): p is number =>
              typeof p === 'number' &&
              Number.isInteger(p) &&
              p > 0 &&
              p < 65536,
          ),
        ),
      ]
        .sort((a, b) => a - b)
        .slice(0, MAX_PORTS)
    : [];
  return {
    ports,
    cpes: strings(o.cpes),
    hostnames: strings(o.hostnames),
    tags: strings(o.tags, 50),
    vulns: strings(o.vulns)
      .filter((v) => /^CVE-\d{4}-\d{4,}$/.test(v))
      .sort(),
  };
}

/**
 * Ports that should rarely be reachable from the internet: remote admin,
 * clear-text logins, file sharing, databases, caches and orchestration APIs.
 */
export const RISKY_PORTS: Record<
  number,
  { service: string; status: FindingStatus }
> = {
  21: { service: 'FTP (clear-text login)', status: 'warn' },
  23: { service: 'Telnet', status: 'fail' },
  135: { service: 'MS RPC', status: 'fail' },
  139: { service: 'NetBIOS', status: 'fail' },
  445: { service: 'SMB', status: 'fail' },
  1433: { service: 'MS SQL Server', status: 'fail' },
  1521: { service: 'Oracle DB', status: 'fail' },
  2375: { service: 'Docker API (no TLS)', status: 'fail' },
  2379: { service: 'etcd', status: 'fail' },
  3306: { service: 'MySQL', status: 'fail' },
  3389: { service: 'RDP', status: 'fail' },
  5432: { service: 'PostgreSQL', status: 'fail' },
  5900: { service: 'VNC', status: 'fail' },
  5984: { service: 'CouchDB', status: 'fail' },
  6379: { service: 'Redis', status: 'fail' },
  9200: { service: 'Elasticsearch', status: 'fail' },
  10250: { service: 'Kubelet API', status: 'fail' },
  11211: { service: 'Memcached', status: 'fail' },
  27017: { service: 'MongoDB', status: 'fail' },
};

export function riskyPorts(ports: number[]): RiskyPort[] {
  return ports.flatMap((port) => {
    const r = RISKY_PORTS[port];
    return r ? [{ port, service: r.service }] : [];
  });
}

/** Tags that indicate a problem (others such as "cdn" or "cloud" are informational). */
const TAG_STATUS: Record<string, FindingStatus> = {
  compromised: 'fail',
  malware: 'fail',
  c2: 'fail',
  'eol-os': 'warn',
  'eol-product': 'warn',
  'self-signed': 'warn',
};

const list = (values: string[], max = 10) =>
  values.length > max
    ? `${values.slice(0, max).join(', ')} (+${values.length - max} more)`
    : values.join(', ');

/** Findings across all addresses: one per risky port, problem tag, and CVE set. */
export function exposureFindings(addresses: ExposureAddress[]): Finding[] {
  const looked = addresses.filter((a) => !a.error);
  if (!looked.length) return [];
  const indexed = looked.filter((a) => a.indexed);
  const findings: Finding[] = [];

  if (!indexed.length) {
    return [
      {
        id: 'exposure.indexed',
        status: 'info',
        title: 'Not in Shodan InternetDB',
        message:
          'No open ports were recorded for these addresses. Absence here is not proof that nothing is exposed.',
        value: list(looked.map((a) => a.ip)),
      },
    ];
  }

  const byPort = new Map<number, string[]>();
  for (const a of indexed) {
    for (const r of a.risky)
      byPort.set(r.port, [...(byPort.get(r.port) ?? []), a.ip]);
  }
  for (const [port, ips] of [...byPort].sort((x, y) => x[0] - y[0])) {
    const r = RISKY_PORTS[port]!;
    findings.push({
      id: `exposure.port.${port}`,
      status: r.status,
      title: `${r.service} reachable (port ${port})`,
      message: `Shodan saw port ${port} open. ${r.service} should normally not be reachable from the internet; restrict it to a VPN or allowlist.`,
      value: list(ips),
    });
  }
  if (!byPort.size) {
    findings.push({
      id: 'exposure.ports',
      status: 'pass',
      title: 'No commonly risky ports seen',
      message: `Open ports seen: ${
        list([...new Set(indexed.flatMap((a) => a.ports))].map(String), 20) ||
        'none'
      }.`,
    });
  }

  const vulns = [...new Set(indexed.flatMap((a) => a.vulns))].sort();
  if (vulns.length) {
    findings.push({
      id: 'exposure.vulns',
      status: 'warn',
      title: `${vulns.length} CVE${vulns.length === 1 ? '' : 's'} matched from banners`,
      message:
        'Shodan matched these from product versions in service banners. They are unverified (backported fixes are common); confirm with CVE Lookup and the vendor.',
      value: list(vulns),
    });
  }

  const tags = new Map<string, string[]>();
  for (const a of indexed) {
    for (const t of a.tags) {
      if (TAG_STATUS[t]) tags.set(t, [...(tags.get(t) ?? []), a.ip]);
    }
  }
  for (const [tag, ips] of tags) {
    findings.push({
      id: `exposure.tag.${tag}`,
      status: TAG_STATUS[tag]!,
      title: `Tagged "${tag}" by Shodan`,
      message:
        tag === 'self-signed'
          ? 'A service presents a self-signed certificate.'
          : tag.startsWith('eol')
            ? 'A product or OS past its end of life was detected.'
            : 'Shodan flagged this address as a security concern; investigate it.',
      value: list(ips),
    });
  }
  return findings;
}
