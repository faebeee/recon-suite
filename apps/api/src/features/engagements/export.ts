import type {
  Engagement,
  EngagementFinding,
  FindingStatus,
  Note,
  RunSummary,
} from '@recon/shared';

export interface ExportData {
  engagement: Engagement;
  findings: EngagementFinding[];
  notes: Note[];
  runs: RunSummary[];
  generatedAt: string;
}

const ORDER: FindingStatus[] = ['fail', 'warn', 'info', 'pass'];
const HEADING: Record<FindingStatus, string> = {
  fail: 'Failed checks',
  warn: 'Warnings',
  info: 'Informational',
  pass: 'Passed checks',
};

/** Escapes text for a Markdown table cell. */
const cell = (s: string | undefined) =>
  (s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function renderMarkdown(d: ExportData): string {
  const e = d.engagement;
  const lines: string[] = [];
  lines.push(`# ${e.name}`, '');
  if (e.client) lines.push(`**Client:** ${e.client}  `);
  lines.push(
    `**Status:** ${e.status}  `,
    `**Generated:** ${d.generatedAt}`,
    '',
  );
  if (e.description) lines.push(e.description, '');

  const count = (s: FindingStatus) =>
    d.findings.filter((f) => f.status === s).length;
  lines.push('## Summary', '');
  lines.push(
    '| Failed | Warnings | Info | Passed | Tool runs |',
    '| --- | --- | --- | --- | --- |',
  );
  lines.push(
    `| ${count('fail')} | ${count('warn')} | ${count('info')} | ${count('pass')} | ${d.runs.length} |`,
    '',
  );

  lines.push('## Findings', '');
  lines.push(
    '_Latest run per tool and target. Passed checks are listed for completeness._',
    '',
  );
  for (const status of ORDER) {
    const group = d.findings.filter((f) => f.status === status);
    if (!group.length) continue;
    lines.push(`### ${HEADING[status]} (${group.length})`, '');
    if (status === 'pass') {
      lines.push('| Tool | Target | Check |', '| --- | --- | --- |');
      for (const f of group)
        lines.push(`| ${f.tool} | \`${cell(f.target)}\` | ${cell(f.title)} |`);
      lines.push('');
      continue;
    }
    for (const f of group) {
      lines.push(`#### ${f.title}: \`${f.target}\``, '');
      lines.push(f.message, '');
      if (f.value) lines.push('```', f.value, '```', '');
      lines.push(
        `_Tool: ${f.tool}, observed ${f.observedAt}, run ${f.runId}_`,
        '',
      );
    }
  }
  if (!d.findings.length) lines.push('_No findings recorded yet._', '');

  if (d.notes.length) {
    lines.push('## Notes', '');
    for (const n of d.notes) {
      lines.push(`### ${n.title}`, '');
      const meta = [
        n.target && `Target: \`${n.target}\``,
        n.tags.length && `Tags: ${n.tags.join(', ')}`,
      ]
        .filter(Boolean)
        .join(' · ');
      if (meta) lines.push(`_${meta}_`, '');
      if (n.body.trim()) lines.push(n.body.trim(), '');
    }
  }

  lines.push('## Tool runs', '');
  if (!d.runs.length) lines.push('_No runs._');
  else {
    lines.push(
      '| Started | Tool | Target | Status | Findings (fail/warn) |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const r of d.runs) {
      lines.push(
        `| ${r.startedAt} | ${r.tool} | \`${cell(r.target)}\` | ${r.status === 'ok' ? 'ok' : `error ${r.error?.status ?? ''}`} | ${r.findingCounts.fail}/${r.findingCounts.warn} |`,
      );
    }
  }
  return lines.join('\n') + '\n';
}

/** RFC 4180 CSV of the findings (one row per finding). */
export function renderCsv(findings: EngagementFinding[]): string {
  const header = [
    'status',
    'title',
    'message',
    'value',
    'tool',
    'target',
    'observed_at',
    'run_id',
    'finding_id',
  ];
  const esc = (v: string | undefined) => {
    const s = v ?? '';
    // Neutralise spreadsheet formulas (CSV injection) and quote every field.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = findings.map((f) =>
    [
      f.status,
      f.title,
      f.message,
      f.value,
      f.tool,
      f.target,
      f.observedAt,
      f.runId,
      f.id,
    ]
      .map(esc)
      .join(','),
  );
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Sort: most severe first, then tool and target. */
export function sortFindings(
  findings: EngagementFinding[],
): EngagementFinding[] {
  return [...findings].sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      a.tool.localeCompare(b.tool) ||
      a.target.localeCompare(b.target),
  );
}
