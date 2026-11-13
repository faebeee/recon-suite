import type { Finding, PortsOutput } from '@recon/shared';

/** Services that should rarely face the internet: fail = never, warn = review. */
const RISKY: Record<number, 'fail' | 'warn'> = {
  21: 'warn',
  23: 'fail',
  445: 'fail',
  1433: 'fail',
  3306: 'fail',
  3389: 'warn',
  5432: 'fail',
  5900: 'fail',
  6379: 'fail',
  9200: 'fail',
  27017: 'fail',
};

export function portsFindings(d: PortsOutput): Finding[] {
  const open = d.results.filter((r) => r.state === 'open');
  const f: Finding[] = open
    .filter((r) => RISKY[r.port])
    .map((r) => ({
      id: `ports.${r.port}`,
      status: RISKY[r.port]!,
      title: `Port ${r.port}${r.service ? ` (${r.service})` : ''} open`,
      message:
        RISKY[r.port] === 'fail'
          ? 'Database, remote-access or file-sharing service reachable from the internet.'
          : 'Service is commonly targeted; confirm it must be exposed.',
    }));
  f.push({
    id: 'ports.open',
    status: 'info',
    title: 'Open ports',
    message: open.length
      ? `${open.length} open port${open.length === 1 ? '' : 's'}.`
      : 'No open ports among those probed.',
    value: open.map((r) => r.port).join(', ') || undefined,
  });
  return f;
}
