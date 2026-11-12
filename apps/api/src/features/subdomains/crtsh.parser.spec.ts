import { parseCrtSh } from './crtsh.parser.js';

describe('parseCrtSh', () => {
  it('dedupes names, strips wildcards and filters foreign names', () => {
    const out = parseCrtSh(
      [
        {
          name_value: 'www.example.com\n*.example.com',
          not_before: '2024-01-01',
          not_after: '2024-04-01',
        },
        {
          name_value: 'WWW.example.com',
          not_before: '2023-01-01',
          not_after: '2025-01-01',
        },
        {
          name_value: 'evil-example.com',
          not_before: '2024-01-01',
          not_after: '2024-02-01',
        },
      ],
      'example.com',
    );
    expect(out.map((s) => s.name)).toEqual(['example.com', 'www.example.com']);
    expect(out[0]!.wildcard).toBe(true);
    expect(out[1]).toMatchObject({
      certificates: 2,
      firstSeen: '2023-01-01',
      lastSeen: '2025-01-01',
    });
  });
});
