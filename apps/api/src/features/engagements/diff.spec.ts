import { diffValues } from './diff.js';

describe('diffValues', () => {
  it('reports added, removed and changed paths, ignoring volatile keys', () => {
    const before = {
      status: 200,
      durationMs: 10,
      headers: { server: 'nginx' },
      ports: [{ port: 22, state: 'open' }],
    };
    const after = {
      status: 301,
      durationMs: 99,
      headers: { server: 'nginx', hsts: 'max-age=1' },
      ports: [{ port: 22, state: 'closed' }],
    };
    expect(diffValues(before, after)).toEqual([
      { path: 'status', kind: 'changed', before: 200, after: 301 },
      { path: 'headers.hsts', kind: 'added', after: 'max-age=1' },
      {
        path: 'ports[0].state',
        kind: 'changed',
        before: 'open',
        after: 'closed',
      },
    ]);
  });

  it('compares primitive arrays as sets', () => {
    expect(
      diffValues({ a: ['1.1.1.1', '1.0.0.1'] }, { a: ['1.0.0.1', '9.9.9.9'] }),
    ).toEqual([
      { path: 'a', kind: 'added', after: '9.9.9.9' },
      { path: 'a', kind: 'removed', before: '1.1.1.1' },
    ]);
  });

  it('returns nothing for equal values', () => {
    expect(diffValues({ x: [1, { y: 2 }] }, { x: [1, { y: 2 }] })).toEqual([]);
  });
});
