import { portsFindings } from './ports.findings.js';

describe('portsFindings', () => {
  it('flags exposed databases and summarises open ports', () => {
    const f = portsFindings({
      address: '93.184.216.34',
      results: [
        { port: 443, service: 'https', state: 'open', latencyMs: 10 },
        { port: 6379, service: 'redis', state: 'open', latencyMs: 10 },
        { port: 3389, service: 'rdp', state: 'filtered' },
      ],
    } as never);
    expect(f.map((x) => [x.id, x.status])).toEqual([
      ['ports.6379', 'fail'],
      ['ports.open', 'info'],
    ]);
    expect(f[1]!.value).toBe('443, 6379');
  });
});
