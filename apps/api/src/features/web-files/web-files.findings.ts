import type { Finding, WebFilesOutput } from '@recon/shared';

export function webFilesFindings(d: WebFilesOutput): Finding[] {
  const f: Finding[] = [];
  if (d.securityTxt) {
    f.push(...d.securityTxt.findings);
  } else {
    f.push({
      id: 'securitytxt.missing',
      status: 'warn',
      title: 'security.txt',
      message:
        'No security.txt: researchers have no published way to report vulnerabilities (RFC 9116).',
    });
  }
  if (d.robots?.interesting.length) {
    f.push({
      id: 'robots.interesting',
      status: 'info',
      title: 'robots.txt paths',
      message: `${d.robots.interesting.length} disallowed/allowed paths hint at admin areas, backups or APIs.`,
      value: d.robots.interesting.slice(0, 20).join(', '),
    });
  }
  return f;
}
