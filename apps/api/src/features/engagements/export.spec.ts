import type { EngagementFinding } from '@recon/shared';
import {
  renderCsv,
  renderMarkdown,
  sortFindings,
  type ExportData,
} from './export.js';

const finding = (over: Partial<EngagementFinding>): EngagementFinding => ({
  id: 'x',
  status: 'warn',
  title: 'T',
  message: 'M',
  runId: 'r1',
  tool: 'dns',
  target: 'example.com',
  observedAt: '2026-11-13T00:00:00.000Z',
  ...over,
});

const data: ExportData = {
  engagement: {
    id: 'e1',
    name: 'ACME Q4',
    client: 'ACME',
    status: 'active',
    createdAt: '',
    updatedAt: '',
    counts: {
      runs: 1,
      notes: 1,
      findings: { fail: 1, warn: 1, pass: 0, info: 0 },
    },
  },
  findings: [
    finding({
      status: 'fail',
      title: 'Zone transfer allowed',
      value: 'ns1 | ns2',
      tool: 'zone-transfer',
    }),
    finding({ status: 'warn', title: 'DMARC policy' }),
  ],
  notes: [
    {
      id: 'n1',
      engagementId: 'e1',
      title: 'Kickoff',
      body: 'Call with IT',
      tags: ['meeting'],
      createdAt: '',
      updatedAt: '',
    },
  ],
  runs: [],
  generatedAt: '2026-11-13T10:00:00.000Z',
};

describe('engagement export', () => {
  it('renders a markdown report with summary, findings and notes', () => {
    const md = renderMarkdown(data);
    expect(md).toContain('# ACME Q4');
    expect(md).toContain('| 1 | 1 | 0 | 0 | 0 |');
    expect(md).not.toContain('## Scope');
    expect(md).toContain('### Failed checks (1)');
    expect(md).toContain('#### Zone transfer allowed: `example.com`');
    expect(md).toContain('### Kickoff');
  });

  it('quotes CSV fields and neutralises formulas', () => {
    const csv = renderCsv([
      finding({ title: '=HYPERLINK("x")', message: 'a "quote", comma' }),
    ]);
    const [, row] = csv.trim().split('\r\n');
    expect(row).toContain('"\'=HYPERLINK(""x"")"');
    expect(row).toContain('"a ""quote"", comma"');
  });

  it('sorts most severe first', () => {
    const sorted = sortFindings([
      finding({ status: 'pass' }),
      finding({ status: 'fail' }),
      finding({ status: 'info' }),
    ]);
    expect(sorted.map((f) => f.status)).toEqual(['fail', 'info', 'pass']);
  });
});
