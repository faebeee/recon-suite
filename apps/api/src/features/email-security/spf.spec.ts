import { evaluateSpf, parseSpf, type TxtLookup } from './spf.js';

const zone =
  (records: Record<string, string[]>): TxtLookup =>
  async (name) =>
    records[name] ?? [];

describe('parseSpf', () => {
  it('parses qualifiers, values and redirect', () => {
    const p = parseSpf(
      'v=spf1 ip4:1.2.3.0/24 -include:_spf.x.test ~all redirect=r.test',
    );
    expect(p.terms).toEqual([
      { qualifier: '+', mechanism: 'ip4', value: '1.2.3.0/24' },
      { qualifier: '-', mechanism: 'include', value: '_spf.x.test' },
      { qualifier: '~', mechanism: 'all', value: undefined },
    ]);
    expect(p.redirect).toBe('r.test');
  });
});

describe('evaluateSpf', () => {
  it('counts lookups through nested includes', async () => {
    const report = await evaluateSpf(
      'a.test',
      zone({
        'a.test': ['v=spf1 mx include:b.test include:c.test -all', 'other'],
        'b.test': ['v=spf1 a include:d.test ~all'],
        'c.test': ['v=spf1 ip4:1.1.1.1 ~all'],
        'd.test': ['v=spf1 exists:x.test ptr ~all'],
      }),
    );
    // mx, include b, include c (3) + a, include d (2) + exists, ptr (2)
    expect(report.lookups).toBe(7);
    expect(report.all).toBe('-all');
    expect(report.includes).toEqual(['b.test', 'd.test', 'c.test']);
    expect(report.errors).toEqual([]);
  });

  it('detects loops and missing includes', async () => {
    const report = await evaluateSpf(
      'a.test',
      zone({
        'a.test': ['v=spf1 include:b.test include:gone.test -all'],
        'b.test': ['v=spf1 include:a.test -all'],
      }),
    );
    expect(report.errors).toEqual([
      'a.test: include loop',
      'gone.test: has no SPF record (permerror)',
    ]);
  });

  it('takes the effective all from a redirect', async () => {
    const report = await evaluateSpf(
      'a.test',
      zone({
        'a.test': ['v=spf1 redirect=_spf.a.test'],
        '_spf.a.test': ['v=spf1 ip4:1.1.1.1 -all'],
      }),
    );
    expect(report.all).toBe('-all');
    expect(report.lookups).toBe(1);
  });

  it('reports multiple SPF records and no record', async () => {
    expect(
      (
        await evaluateSpf(
          'a.test',
          zone({ 'a.test': ['v=spf1 -all', 'v=spf1 ~all'] }),
        )
      ).recordCount,
    ).toBe(2);
    const none = await evaluateSpf('a.test', zone({}));
    expect(none.recordCount).toBe(0);
    expect(none.record).toBeUndefined();
  });

  it('stops following includes past the fetch cap', async () => {
    const records: Record<string, string[]> = {};
    for (let i = 0; i < 40; i++) {
      records[i === 0 ? 'a.test' : `n${i}.test`] = [
        `v=spf1 include:n${i + 1}.test -all`,
      ];
    }
    const report = await evaluateSpf('a.test', zone(records));
    expect(report.lookups).toBeLessThanOrEqual(26);
    expect(report.errors.some((e) => e.includes('not followed'))).toBe(true);
  });
});
