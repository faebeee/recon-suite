import {
  parseBanner,
  parseMysqlHandshake,
  sanitizeBanner,
} from './banner.parser.js';

const txt = (s: string) => Buffer.from(s, 'latin1');

/** Builds a MySQL protocol-10 handshake packet around a server version string. */
const mysqlHandshake = (version: string) => {
  const payload = Buffer.concat([
    Buffer.from([10]),
    Buffer.from(version, 'latin1'),
    Buffer.from([0, 0x2a, 0, 0, 0, 0x41, 0x42, 0x43, 0x44, 0, 0xff, 0xf7]),
  ]);
  const header = Buffer.alloc(4);
  header.writeUIntLE(payload.length, 0, 3);
  return Buffer.concat([header, payload]);
};

describe('parseBanner', () => {
  it.each([
    [
      'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\r\n',
      22,
      { service: 'ssh', product: 'OpenSSH', version: '8.9p1' },
    ],
    [
      'SSH-2.0-OpenSSH_6.6.1p1 Ubuntu-2ubuntu2.13\r\n',
      22,
      { service: 'ssh', product: 'OpenSSH', version: '6.6.1p1' },
    ],
    [
      'SSH-2.0-dropbear_2022.83\r\n',
      22,
      { service: 'ssh', product: 'Dropbear', version: '2022.83' },
    ],
    [
      'SSH-2.0-OpenSSH_for_Windows_8.1\r\n',
      22,
      { service: 'ssh', product: 'OpenSSH for Windows', version: '8.1' },
    ],
    [
      '220 ProFTPD 1.3.5e Server (Debian) [::ffff:203.0.113.5]\r\n',
      21,
      { service: 'ftp', product: 'ProFTPD', version: '1.3.5e' },
    ],
    [
      '220 (vsFTPd 3.0.3)\r\n',
      21,
      { service: 'ftp', product: 'vsFTPd', version: '3.0.3' },
    ],
    [
      '220---------- Welcome to Pure-FTPd [privsep] [TLS] ----------\r\n220-You are user number 1 of 50 allowed.\r\n',
      21,
      { service: 'ftp', product: 'Pure-FTPd', version: undefined },
    ],
    [
      '220-FileZilla Server version 0.9.41 beta\r\n220 Welcome\r\n',
      21,
      { service: 'ftp', product: 'FileZilla Server', version: '0.9.41' },
    ],
    [
      '220-FileZilla Server 1.7.0\r\n220 Please visit https://filezilla-project.org/\r\n',
      21,
      { service: 'ftp', product: 'FileZilla Server', version: '1.7.0' },
    ],
    [
      '220 Microsoft FTP Service\r\n',
      21,
      { service: 'ftp', product: 'Microsoft FTP Service', version: undefined },
    ],
    [
      '220 mail.example.com ESMTP Postfix (Ubuntu)\r\n',
      25,
      { service: 'smtp', product: 'Postfix', version: undefined },
    ],
    [
      '220 mx.example.org ESMTP Exim 4.96 Mon, 13 Nov 2026 10:00:00 +0000\r\n',
      25,
      { service: 'smtp', product: 'Exim', version: '4.96' },
    ],
    [
      '220 host.example.net ESMTP Sendmail 8.15.2/8.15.2; Mon, 13 Nov 2026 10:00:00 GMT\r\n',
      25,
      { service: 'smtp', product: 'Sendmail', version: '8.15.2' },
    ],
    [
      '220 EX01.corp.example Microsoft ESMTP MAIL Service ready at Mon, 13 Nov 2026 10:00:00 +0100\r\n',
      25,
      {
        service: 'smtp',
        product: 'Microsoft ESMTP MAIL Service',
        version: undefined,
      },
    ],
    [
      '220 mail.example.com Microsoft ESMTP MAIL Service, Version: 10.0.17763.1697 ready at Mon\r\n',
      587,
      {
        service: 'smtp',
        product: 'Microsoft ESMTP MAIL Service',
        version: '10.0.17763.1697',
      },
    ],
    [
      '220 mail.example.com ESMTP OpenSMTPD\r\n',
      25,
      { service: 'smtp', product: 'OpenSMTPD', version: undefined },
    ],
    [
      '* OK [CAPABILITY IMAP4rev1 SASL-IR LOGIN-REFERRALS ID ENABLE IDLE LITERAL+ STARTTLS AUTH=PLAIN] Dovecot (Ubuntu) ready.\r\n',
      143,
      { service: 'imap', product: 'Dovecot', version: undefined },
    ],
    [
      '* OK [CAPABILITY IMAP4rev1 UIDPLUS CHILDREN NAMESPACE] Courier-IMAP ready. Copyright 1998-2018 Double Precision, Inc.\r\n',
      143,
      { service: 'imap', product: 'Courier', version: undefined },
    ],
    [
      '* OK [CAPABILITY IMAP4rev1 LITERAL+ ID ENABLE] imap.example.com Cyrus IMAP v2.4.17-Debian-2.4.17 server ready\r\n',
      143,
      { service: 'imap', product: 'Cyrus', version: '2.4.17-Debian-2.4.17' },
    ],
    [
      '* OK The Microsoft Exchange IMAP4 service is ready.\r\n',
      993,
      { service: 'imap', product: 'Microsoft Exchange', version: undefined },
    ],
    [
      '+OK Dovecot (Debian) ready.\r\n',
      110,
      { service: 'pop3', product: 'Dovecot', version: undefined },
    ],
    [
      '+OK Hello there.\r\n',
      110,
      { service: 'pop3', product: 'Courier', version: undefined },
    ],
    ['+OK POP3 server ready\r\n', 110, { service: 'pop3' }],
    ['* OK IMAP4 ready\r\n', 143, { service: 'imap' }],
    ['220 Service ready\r\n', 21, { service: 'ftp' }],
    ['220 Service ready\r\n', 25, { service: 'smtp' }],
    ['220 Service ready\r\n', 8021, { service: 'ftp/smtp' }],
  ])('identifies %j', (banner, port, expected) => {
    const out = parseBanner(txt(banner), port);
    expect(out).toMatchObject(expected);
    if (!('product' in expected)) expect(out.product).toBeUndefined();
  });

  it('leaves unknown protocols unidentified', () => {
    expect(parseBanner(txt('hello world\n'))).toEqual({
      banner: 'hello world',
    });
  });

  it('identifies MySQL and MariaDB handshakes', () => {
    expect(
      parseBanner(mysqlHandshake('8.0.36-0ubuntu0.22.04.1')),
    ).toMatchObject({ service: 'mysql', product: 'MySQL', version: '8.0.36' });
    expect(
      parseBanner(mysqlHandshake('5.5.5-10.6.12-MariaDB-0ubuntu0.22.04.1')),
    ).toMatchObject({
      service: 'mysql',
      product: 'MariaDB',
      version: '10.6.12',
    });
    expect(parseBanner(mysqlHandshake('11.4.2-MariaDB'))).toMatchObject({
      product: 'MariaDB',
      version: '11.4.2',
    });
  });

  it('recognises a MySQL "host not allowed" error packet', () => {
    const msg = Buffer.from(
      "Host '203.0.113.9' is not allowed to connect to this MySQL server",
      'latin1',
    );
    const payload = Buffer.concat([Buffer.from([0xff, 0x6a, 0x04]), msg]);
    const header = Buffer.alloc(4);
    header.writeUIntLE(payload.length, 0, 3);
    expect(parseMysqlHandshake(Buffer.concat([header, payload]))).toEqual({
      service: 'mysql',
    });
  });

  it('does not mistake text for a MySQL packet', () => {
    expect(parseMysqlHandshake(txt('220 hi there\r\n'))).toBeUndefined();
  });
});

describe('sanitizeBanner', () => {
  it('normalises CRLF and escapes control bytes', () => {
    expect(sanitizeBanner(Buffer.from('a\r\nb\x00\x07c\x1b[0m'))).toBe(
      'a\nb\\x00\\x07c\\x1b[0m',
    );
  });

  it('caps the excerpt at 512 characters', () => {
    expect(sanitizeBanner(Buffer.alloc(4096, 0x41))).toHaveLength(512);
    expect(sanitizeBanner(Buffer.alloc(400, 0))).toHaveLength(512);
  });
});
