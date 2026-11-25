import type { Finding, FindingStatus, ToolResult } from '@recon/shared';
import type { Discovery, RadarBlip, RadarGroup } from './radar-layout';

const FINDING_GROUPS: (RadarGroup & { status: FindingStatus })[] = [
  {
    id: 'finding:fail',
    status: 'fail',
    label: 'Failed checks',
    tone: 'magenta',
  },
  { id: 'finding:warn', status: 'warn', label: 'Warnings', tone: 'yellow' },
  { id: 'finding:pass', status: 'pass', label: 'Passed checks', tone: 'green' },
  { id: 'finding:info', status: 'info', label: 'Info', tone: 'cyan' },
];

function findingBlip(f: Finding, i: number): RadarBlip {
  return {
    id: `finding:${i}:${f.id}`,
    label: f.title,
    group: `finding:${f.status}`,
    detail: [f.message, f.value && `Value: ${f.value}`]
      .filter(Boolean)
      .join('\n\n'),
  };
}

/**
 * Everything a tool run can export to Intel View: the tool's own items (if it maps its
 * output) followed by its graded findings, grouped by status (fails first).
 */
export function resultDiscovery(
  result: Pick<ToolResult<unknown>, 'target' | 'findings'>,
  own?: Discovery,
): Discovery {
  const findings = result.findings ?? [];
  return {
    center: own?.center ?? result.target,
    groups: [...(own?.groups ?? []), ...FINDING_GROUPS],
    blips: [...(own?.blips ?? []), ...findings.map(findingBlip)],
  };
}
