import { describe, expect, it } from 'vitest';
import { buildPosture, type PostureRow } from './posture.js';

const row = (p: Partial<PostureRow>): PostureRow => ({
  id: 'r',
  tool: 'http-headers',
  target: 'https://example.com',
  startedAt: '2026-11-01T10:00:00.000Z',
  value: 'A',
  score: 90,
  ...p,
});

describe('buildPosture', () => {
  it('groups per tool and target, oldest point first', () => {
    const series = buildPosture([
      row({
        id: 'b',
        startedAt: '2026-11-02T10:00:00.000Z',
        value: 'B',
        score: 75,
      }),
      row({
        id: 'a',
        startedAt: '2026-11-01T10:00:00.000Z',
        value: 'C',
        score: 60,
      }),
      row({
        id: 't',
        tool: 'tls-audit',
        target: 'example.com',
        value: 'A',
        score: 92,
      }),
      row({
        id: 'd',
        tool: 'dnssec',
        target: 'example.com',
        value: 'secure',
        score: null,
      }),
      row({
        id: 'e',
        tool: 'email-security',
        target: 'example.com',
        value: 'F',
        score: 20,
      }),
    ]);
    expect(series.map((s) => s.tool)).toEqual([
      'http-headers',
      'tls-audit',
      'dnssec',
      'email-security',
    ]);
    expect(series[0]?.points).toEqual([
      {
        runId: 'a',
        observedAt: '2026-11-01T10:00:00.000Z',
        value: 'C',
        score: 60,
      },
      {
        runId: 'b',
        observedAt: '2026-11-02T10:00:00.000Z',
        value: 'B',
        score: 75,
      },
    ]);
    expect(series[2]?.points).toEqual([
      { runId: 'd', observedAt: '2026-11-01T10:00:00.000Z', value: 'secure' },
    ]);
  });

  it('keeps targets apart and sorts them', () => {
    const series = buildPosture([
      row({ id: '1', target: 'https://b.example.com' }),
      row({ id: '2', target: 'https://a.example.com' }),
    ]);
    expect(series.map((s) => s.target)).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('skips unknown tools and values that do not fit the tool', () => {
    expect(
      buildPosture([
        row({ tool: 'dns' }),
        row({ value: 'secure' }),
        row({ tool: 'dnssec', value: 'A' }),
        row({ value: null }),
        row({ value: 'Z' }),
      ]),
    ).toEqual([]);
  });
});
