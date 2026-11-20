import type { Finding, ToolId, ToolResult } from '@recon/shared';
import { compareSnapshots, sameInput, snapshot } from './changes.js';

const result = (
  tool: ToolId,
  data: unknown,
  findings?: Finding[],
): ToolResult<unknown> => ({
  tool,
  target: 'example.com',
  startedAt: '2026-01-01T00:00:00Z',
  durationMs: 1,
  data,
  ...(findings && { findings }),
});

const compare = (tool: ToolId, before: unknown, after: unknown) =>
  compareSnapshots(
    snapshot(tool, result(tool, before)),
    snapshot(tool, result(tool, after)),
  ).items;

describe('change monitoring', () => {
  it('reports added and removed subdomains', () => {
    const sub = (name: string) => ({ name, wildcard: false });
    expect(
      compare(
        'subdomains',
        { subdomains: [sub('a.example.com'), sub('old.example.com')] },
        { subdomains: [sub('a.example.com'), sub('api.example.com')] },
      ),
    ).toEqual([
      { facet: 'Subdomains', key: 'api.example.com', kind: 'added' },
      { facet: 'Subdomains', key: 'old.example.com', kind: 'removed' },
    ]);
  });

  it('tracks open nmap ports and their service versions', () => {
    const port = (port: number, state: string, version?: string) => ({
      port,
      protocol: 'tcp',
      state,
      service: 'http',
      product: 'nginx',
      version,
    });
    expect(
      compare(
        'nmap',
        { ports: [port(80, 'open', '1.24'), port(22, 'open')] },
        {
          ports: [
            port(80, 'open', '1.25'),
            port(22, 'closed'),
            port(8080, 'open'),
          ],
        },
      ),
    ).toEqual([
      {
        facet: 'Open ports',
        key: '80/tcp',
        kind: 'changed',
        before: 'http nginx 1.24',
        after: 'http nginx 1.25',
      },
      {
        facet: 'Open ports',
        key: '8080/tcp',
        kind: 'added',
        after: 'http nginx',
      },
      {
        facet: 'Open ports',
        key: '22/tcp',
        kind: 'removed',
        before: 'http nginx',
      },
    ]);
  });

  it('compares findings by status and the grade for every tool', () => {
    const before = result(
      'http-headers',
      { security: { grade: 'B', score: 75 }, headers: {} },
      [{ id: 'csp', status: 'warn', title: 'CSP', message: '' }],
    );
    const after = result(
      'http-headers',
      { security: { grade: 'A', score: 90 }, headers: {} },
      [{ id: 'csp', status: 'pass', title: 'CSP', message: 'fixed' }],
    );
    expect(
      compareSnapshots(
        snapshot('http-headers', before),
        snapshot('http-headers', after),
      ).items,
    ).toEqual([
      {
        facet: 'Findings',
        key: 'CSP',
        kind: 'changed',
        before: 'warn',
        after: 'pass',
      },
      {
        facet: 'Grade',
        key: 'Grade',
        kind: 'changed',
        before: 'B (75)',
        after: 'A (90)',
      },
    ]);
  });

  it('ignores volatile response headers', () => {
    expect(
      compare(
        'http-headers',
        { headers: { date: 'Mon', 'cf-ray': '1', server: 'nginx' } },
        { headers: { date: 'Tue', 'cf-ray': '2', server: 'nginx' } },
      ),
    ).toEqual([]);
  });

  it('describes cookie flags without "false" noise', () => {
    expect(
      compare(
        'cookie-audit',
        { cookies: [{ name: 'sid', secure: false, httpOnly: true }] },
        {
          cookies: [
            { name: 'sid', secure: true, httpOnly: true, sameSite: 'Lax' },
          ],
        },
      ),
    ).toEqual([
      {
        facet: 'Cookies',
        key: 'sid',
        kind: 'changed',
        before: 'HttpOnly',
        after: 'Secure HttpOnly SameSite=Lax',
      },
    ]);
  });

  it('survives malformed stored output', () => {
    expect(compare('dns', { records: 'nope' }, null)).toEqual([]);
    expect(snapshot('dns', undefined).size).toBe(0);
  });

  it('caps the number of items', () => {
    const many = (n: number) => ({
      subdomains: Array.from({ length: n }, (_, i) => ({ name: `h${i}.x` })),
    });
    const out = compareSnapshots(
      snapshot('subdomains', result('subdomains', many(0))),
      snapshot('subdomains', result('subdomains', many(250))),
    );
    expect(out.items).toHaveLength(200);
    expect(out.truncated).toBe(true);
  });
});

describe('sameInput', () => {
  it('ignores key order but not values', () => {
    expect(sameInput({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(sameInput({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameInput(null, undefined)).toBe(true);
  });
});
