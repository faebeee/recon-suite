/** Longest banner excerpt returned to the client. */
export const MAX_BANNER_CHARS = 512;

export interface BannerInfo {
  banner: string;
  service?: string;
  product?: string;
  version?: string;
}

type Identity = Omit<BannerInfo, 'banner'>;

const FTP_PORTS = new Set([21, 990, 2121]);
const SMTP_PORTS = new Set([25, 465, 587, 2525]);

/** Version token: starts with a digit, then digits, letters, dots, underscores, dashes. */
const VER = '(\\d[\\w.-]*)';

interface ProductRule {
  re: RegExp;
  product: string;
}

/** Products per text protocol. The first capture group, when present, is the version. */
const FTP_PRODUCTS: ProductRule[] = [
  { re: new RegExp(`ProFTPD\\s+${VER}`, 'i'), product: 'ProFTPD' },
  { re: /ProFTPD/i, product: 'ProFTPD' },
  { re: new RegExp(`vsFTPd\\s+${VER}`, 'i'), product: 'vsFTPd' },
  { re: /Pure-FTPd/i, product: 'Pure-FTPd' },
  {
    re: new RegExp(`FileZilla Server(?:\\s+version)?\\s+${VER}`, 'i'),
    product: 'FileZilla Server',
  },
  { re: /FileZilla Server/i, product: 'FileZilla Server' },
  { re: /Microsoft FTP Service/i, product: 'Microsoft FTP Service' },
];

const SMTP_PRODUCTS: ProductRule[] = [
  { re: /\bPostfix\b/i, product: 'Postfix' },
  { re: new RegExp(`\\bExim\\s+${VER}`, 'i'), product: 'Exim' },
  { re: /\bExim\b/i, product: 'Exim' },
  { re: new RegExp(`\\bSendmail\\s+${VER}`, 'i'), product: 'Sendmail' },
  { re: /\bSendmail\b/i, product: 'Sendmail' },
  {
    re: new RegExp(
      `Microsoft ESMTP MAIL Service(?:,\\s*Version:?\\s*${VER})?`,
      'i',
    ),
    product: 'Microsoft ESMTP MAIL Service',
  },
  { re: /\bOpenSMTPD\b/i, product: 'OpenSMTPD' },
];

const MAIL_STORE_PRODUCTS: ProductRule[] = [
  { re: /\bDovecot\b/i, product: 'Dovecot' },
  { re: /Courier-IMAP/i, product: 'Courier' },
  { re: /\+OK Hello there\./, product: 'Courier' },
  {
    re: new RegExp(`Cyrus (?:IMAP|POP3)[\\w ]*?\\s+v?${VER}`, 'i'),
    product: 'Cyrus',
  },
  { re: /\bCyrus\b/i, product: 'Cyrus' },
  { re: /Microsoft Exchange/i, product: 'Microsoft Exchange' },
];

const SSH_PRODUCT_NAMES: Record<string, string> = {
  openssh: 'OpenSSH',
  openssh_for_windows: 'OpenSSH for Windows',
  dropbear: 'Dropbear',
  libssh: 'libssh',
  libssh2: 'libssh2',
};

/**
 * Turns the raw bytes a server sent on connect into a printable excerpt and a best-effort
 * service/product/version guess. Pure, so it is unit-tested with real-world banners.
 */
export function parseBanner(data: Buffer, port?: number): BannerInfo {
  const banner = sanitizeBanner(data);
  const mysql = parseMysqlHandshake(data);
  if (mysql) return { banner, ...mysql };

  const text = data.toString('latin1');
  return { banner, ...identifyText(text, port) };
}

/** Printable text: CRLF -> LF, tabs/newlines kept, other control bytes as \xHH; max 512 chars. */
export function sanitizeBanner(data: Buffer): string {
  let out = '';
  // latin1 maps every byte to one code point, so binary handshakes stay readable.
  const text = data.toString('latin1').replace(/\r\n/g, '\n');
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (ch === '\n' || ch === '\t' || (code >= 0x20 && code < 0x7f)) {
      out += ch;
    } else if (code >= 0xa0) {
      out += ch;
    } else {
      out += `\\x${code.toString(16).padStart(2, '0')}`;
    }
    if (out.length >= MAX_BANNER_CHARS) break;
  }
  return out.slice(0, MAX_BANNER_CHARS).trimEnd();
}

/**
 * MySQL/MariaDB send a handshake packet first: 3-byte little-endian payload length,
 * sequence id 0, protocol version 10, then the NUL-terminated server version. A server
 * that refuses the client host sends an error packet (0xff) instead.
 */
export function parseMysqlHandshake(data: Buffer): Identity | undefined {
  if (data.length < 6 || data[3] !== 0) return undefined;
  const length = data.readUIntLE(0, 3);
  if (length < 2 || length > 0xffff) return undefined;

  if (data[4] === 0xff) {
    const message = data.toString(
      'latin1',
      7,
      Math.min(data.length, 4 + length),
    );
    return /mysql|mariadb|host '.*' is not allowed/i.test(message)
      ? { service: 'mysql' }
      : undefined;
  }
  if (data[4] !== 10) return undefined;

  const end = data.indexOf(0, 5);
  if (end < 0) return undefined;
  const raw = data.toString('latin1', 5, end);
  if (!/^\d+\.\d+/.test(raw)) return undefined;

  if (/mariadb/i.test(raw)) {
    // MariaDB < 11 prefixes "5.5.5-" for old clients: "5.5.5-10.6.12-MariaDB-0ubuntu0.22.04.1".
    const version = /^(?:5\.5\.5-)?(\d+(?:\.\d+)*)/.exec(raw)?.[1];
    return { service: 'mysql', product: 'MariaDB', version };
  }
  return {
    service: 'mysql',
    product: 'MySQL',
    version: /^(\d+(?:\.\d+)*)/.exec(raw)?.[1],
  };
}

function identifyText(text: string, port?: number): Identity {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';

  if (/^SSH-\d/.test(firstLine)) return parseSsh(firstLine);

  if (/^220[ -]/.test(text)) {
    const service = /\bE?SMTP\b|\bmail\b/i.test(text)
      ? 'smtp'
      : /FTP/i.test(text)
        ? 'ftp'
        : port !== undefined && FTP_PORTS.has(port)
          ? 'ftp'
          : port !== undefined && SMTP_PORTS.has(port)
            ? 'smtp'
            : 'ftp/smtp';
    const rules =
      service === 'ftp'
        ? FTP_PRODUCTS
        : service === 'smtp'
          ? SMTP_PRODUCTS
          : [...FTP_PRODUCTS, ...SMTP_PRODUCTS];
    return { service, ...matchProduct(text, rules) };
  }

  if (/^\* OK\b/.test(text)) {
    return { service: 'imap', ...matchProduct(text, MAIL_STORE_PRODUCTS) };
  }
  if (/^\+OK\b/.test(text)) {
    return { service: 'pop3', ...matchProduct(text, MAIL_STORE_PRODUCTS) };
  }
  return {};
}

/** "SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6" -> ssh / OpenSSH / 8.9p1 */
function parseSsh(line: string): Identity {
  const software = /^SSH-[\d.]+-(\S+)/.exec(line)?.[1];
  if (!software) return { service: 'ssh' };
  const m = /^(.*?)[_-]v?(\d[\w.]*)$/.exec(software);
  const name = m ? m[1]! : software;
  const product =
    SSH_PRODUCT_NAMES[name.toLowerCase()] ?? name.replace(/_/g, ' ');
  return { service: 'ssh', product, version: m?.[2] };
}

function matchProduct(
  text: string,
  rules: ProductRule[],
): Pick<Identity, 'product' | 'version'> {
  for (const { re, product } of rules) {
    const m = re.exec(text);
    if (m) return { product, version: m[1]?.replace(/[.-]+$/, '') };
  }
  return {};
}
