import { formatCaa, formatMx, formatTxt } from './dns.formatters.js';

describe('dns formatters', () => {
  it('sorts MX by priority', () => {
    expect(
      formatMx([
        { priority: 20, exchange: 'b.mx' },
        { priority: 10, exchange: 'a.mx' },
      ]),
    ).toEqual(['10 a.mx', '20 b.mx']);
  });

  it('joins TXT chunks', () => {
    expect(formatTxt([['v=spf1 ', 'include:x -all']])).toEqual([
      'v=spf1 include:x -all',
    ]);
  });

  it('formats CAA records', () => {
    expect(formatCaa([{ critical: 0, issue: 'letsencrypt.org' }])).toEqual([
      '0 issue "letsencrypt.org"',
    ]);
  });
});
