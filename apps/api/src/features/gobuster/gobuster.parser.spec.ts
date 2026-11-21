import {
  buildGobusterArgs,
  connectTarget,
  gobusterFindings,
  parseGobusterOutput,
  wildcardHint,
} from './gobuster.parser.js';

describe('gobuster parser', () => {
  it('connects to the resolved IP and keeps the hostname in the Host header', () => {
    expect(connectTarget('https://www.x.test/app?q=1', '192.0.2.10')).toEqual({
      url: 'https://192.0.2.10/app/',
      host: 'www.x.test',
      insecure: true,
      base: 'https://www.x.test/app/',
    });
    expect(connectTarget('http://x.test:8080', '2001:db8::1')).toEqual({
      url: 'http://[2001:db8::1]:8080/',
      host: 'x.test:8080',
      insecure: false,
      base: 'http://x.test:8080/',
    });
  });

  it('builds a fixed argument list', () => {
    expect(
      buildGobusterArgs({
        url: 'https://192.0.2.10/',
        host: 'x.test',
        insecure: true,
        wordlistPath: '/usr/share/wordlists/dirb/common.txt',
        extensions: ['php', 'bak'],
        threads: 20,
        excludeLengths: [1234],
      }),
    ).toEqual([
      'dir',
      '--url',
      'https://192.0.2.10/',
      '--wordlist',
      '/usr/share/wordlists/dirb/common.txt',
      '--threads',
      '20',
      '--timeout',
      '10s',
      '--headers',
      'Host: x.test',
      '--quiet',
      '--no-progress',
      '--no-color',
      '--no-error',
      '--no-tls-validation',
      '--extensions',
      'php,bak',
      '--exclude-length',
      '1234',
    ]);
  });

  it('parses result lines and maps redirects back to the hostname', () => {
    const stdout = [
      '===============================================================',
      '/admin                (Status: 301) [Size: 178] [--> http://192.0.2.10/admin/]',
      '\u001b[32m/index.php\u001b[0m            (Status: 200) [Size: 5120]',
      'backup.zip           (Status: 200) [Size: 99]',
      '/login                (Status: 302) [Size: 0] [--> https://sso.x.test/auth]',
      '/admin                (Status: 301) [Size: 178]',
      'Progress: 4614 / 4615 (99.98%)',
    ].join('\n');
    expect(
      parseGobusterOutput(
        stdout,
        'http://x.test/app/',
        'http://192.0.2.10/app/',
      ),
    ).toEqual([
      {
        path: '/app/admin',
        url: 'http://x.test/app/admin',
        status: 301,
        length: 178,
        redirect: 'http://x.test/admin/',
      },
      {
        path: '/app/backup.zip',
        url: 'http://x.test/app/backup.zip',
        status: 200,
        length: 99,
      },
      {
        path: '/app/index.php',
        url: 'http://x.test/app/index.php',
        status: 200,
        length: 5120,
      },
      {
        path: '/app/login',
        url: 'http://x.test/app/login',
        status: 302,
        length: 0,
        redirect: 'https://sso.x.test/auth',
      },
    ]);
  });

  it('explains the wildcard refusal with the length to exclude', () => {
    const stderr =
      'Error: the server returns a status code that matches the provided options for non existing urls. http://192.0.2.10/8d3c => 200 (Length: 1534). Please exclude the response length or the status code or set the wildcard option.';
    expect(wildcardHint(stderr)).toMatch(/HTTP 200 and a 1534-byte page/);
    expect(wildcardHint(stderr)).toMatch(/Add 1534 to "Exclude lengths"/);
    expect(wildcardHint('Error: connection refused')).toBeUndefined();
  });

  it('warns about backups and lists the rest as information', () => {
    expect(
      gobusterFindings([
        { path: '/site.tar.gz', url: '', status: 200 },
        { path: '/admin', url: '', status: 403 },
      ]).map((f) => [f.id, f.status]),
    ).toEqual([
      ['gobuster.backup:/site.tar.gz', 'warn'],
      ['gobuster.path:/admin', 'info'],
    ]);
  });
});
