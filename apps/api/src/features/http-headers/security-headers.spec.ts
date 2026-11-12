import { analyzeSecurityHeaders } from './security-headers.js';

describe('analyzeSecurityHeaders', () => {
  it('grades a hardened response A+', () => {
    const report = analyzeSecurityHeaders(
      {
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=()',
        'cross-origin-opener-policy': 'same-origin',
      },
      true,
    );
    expect(report.grade).toBe('A+');
    expect(report.score).toBe(100);
  });

  it('grades a bare http response F and reports disclosures', () => {
    const report = analyzeSecurityHeaders(
      { server: 'Apache/2.4.1', 'x-powered-by': 'PHP/7.0' },
      false,
    );
    expect(report.grade).toBe('F');
    expect(report.disclosures.map((d) => d.header)).toEqual([
      'server',
      'x-powered-by',
    ]);
  });
});
