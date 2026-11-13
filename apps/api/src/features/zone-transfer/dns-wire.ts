/**
 * Minimal DNS wire format (RFC 1035) encoder/decoder for AXFR over TCP.
 * Pure and defensive: every read is bounds-checked and compression pointers
 * are loop-protected, because the bytes come from an untrusted server.
 */

export const QTYPE_AXFR = 252;
export const CLASS_IN = 1;

export const RCODE = {
  NOERROR: 0,
  FORMERR: 1,
  SERVFAIL: 2,
  NXDOMAIN: 3,
  NOTIMP: 4,
  REFUSED: 5,
  NOTAUTH: 9,
} as const;

const TYPE_NAMES: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  13: 'HINFO',
  15: 'MX',
  16: 'TXT',
  17: 'RP',
  18: 'AFSDB',
  28: 'AAAA',
  29: 'LOC',
  33: 'SRV',
  35: 'NAPTR',
  39: 'DNAME',
  43: 'DS',
  44: 'SSHFP',
  46: 'RRSIG',
  47: 'NSEC',
  48: 'DNSKEY',
  50: 'NSEC3',
  51: 'NSEC3PARAM',
  52: 'TLSA',
  64: 'SVCB',
  65: 'HTTPS',
  99: 'SPF',
  257: 'CAA',
};

export function typeName(type: number): string {
  return TYPE_NAMES[type] ?? `TYPE${type}`;
}

export class DnsWireError extends Error {}

/** Encodes a domain name as length-prefixed labels (no compression). */
export function encodeName(name: string): Buffer {
  const trimmed = name.replace(/\.$/, '');
  const parts: Buffer[] = [];
  if (trimmed) {
    for (const label of trimmed.split('.')) {
      const bytes = Buffer.from(label, 'ascii');
      if (bytes.length === 0 || bytes.length > 63) {
        throw new DnsWireError(`Invalid label in "${name}"`);
      }
      parts.push(Buffer.from([bytes.length]), bytes);
    }
  }
  parts.push(Buffer.from([0]));
  const out = Buffer.concat(parts);
  if (out.length > 255) throw new DnsWireError(`Name too long: "${name}"`);
  return out;
}

/** Builds an AXFR query message (without the TCP length prefix). */
export function buildAxfrQuery(domain: string, id: number): Buffer {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id & 0xffff, 0);
  header.writeUInt16BE(0, 2); // standard query, no recursion
  header.writeUInt16BE(1, 4); // QDCOUNT
  const question = Buffer.alloc(4);
  question.writeUInt16BE(QTYPE_AXFR, 0);
  question.writeUInt16BE(CLASS_IN, 2);
  return Buffer.concat([header, encodeName(domain), question]);
}

/** Prepends the 2-byte length used for DNS over TCP. */
export function frameTcp(message: Buffer): Buffer {
  const len = Buffer.alloc(2);
  len.writeUInt16BE(message.length, 0);
  return Buffer.concat([len, message]);
}

/** Splits a TCP byte stream into DNS messages. */
export class TcpMessageReader {
  private buf: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): Buffer[] {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    const messages: Buffer[] = [];
    while (this.buf.length >= 2) {
      const len = this.buf.readUInt16BE(0);
      if (this.buf.length < 2 + len) break;
      messages.push(this.buf.subarray(2, 2 + len));
      this.buf = this.buf.subarray(2 + len);
    }
    return messages;
  }
}

const MAX_POINTER_JUMPS = 32;

/** Reads a (possibly compressed) name. `next` is the offset after the name in place. */
export function readName(
  msg: Buffer,
  offset: number,
): { name: string; next: number } {
  const labels: string[] = [];
  let pos = offset;
  let next = -1;
  let jumps = 0;
  let length = 0;
  for (;;) {
    if (pos >= msg.length) throw new DnsWireError('Name runs past message end');
    const len = msg[pos]!;
    if ((len & 0xc0) === 0xc0) {
      if (pos + 1 >= msg.length) {
        throw new DnsWireError('Truncated compression pointer');
      }
      const target = ((len & 0x3f) << 8) | msg[pos + 1]!;
      if (next < 0) next = pos + 2;
      // Pointers must go backwards; together with the jump cap this stops loops.
      if (target >= pos || ++jumps > MAX_POINTER_JUMPS) {
        throw new DnsWireError('Compression pointer loop');
      }
      pos = target;
      continue;
    }
    if ((len & 0xc0) !== 0) throw new DnsWireError('Unsupported label type');
    if (len === 0) {
      if (next < 0) next = pos + 1;
      break;
    }
    if (pos + 1 + len > msg.length) {
      throw new DnsWireError('Label runs past message end');
    }
    length += len + 1;
    if (length > 255) throw new DnsWireError('Name too long');
    labels.push(escapeLabel(msg.subarray(pos + 1, pos + 1 + len)));
    pos += 1 + len;
  }
  return { name: labels.length ? labels.join('.') + '.' : '.', next };
}

function escapeLabel(bytes: Buffer): string {
  let s = '';
  for (const b of bytes) {
    if (b === 0x2e || b === 0x5c) s += '\\' + String.fromCharCode(b);
    else if (b > 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else s += '\\' + String(b).padStart(3, '0');
  }
  return s;
}

export interface DnsHeader {
  id: number;
  qr: boolean;
  opcode: number;
  aa: boolean;
  tc: boolean;
  rcode: number;
  qdcount: number;
  ancount: number;
  nscount: number;
  arcount: number;
}

export interface DnsRecord {
  name: string;
  type: number;
  class: number;
  ttl: number;
  /** Presentation format of the RDATA. */
  value: string;
}

export interface DnsMessage {
  header: DnsHeader;
  answers: DnsRecord[];
}

/** Parses a message: header, skips questions, decodes the answer section. */
export function parseMessage(msg: Buffer): DnsMessage {
  if (msg.length < 12) throw new DnsWireError('Message shorter than header');
  const flags = msg.readUInt16BE(2);
  const header: DnsHeader = {
    id: msg.readUInt16BE(0),
    qr: (flags & 0x8000) !== 0,
    opcode: (flags >> 11) & 0xf,
    aa: (flags & 0x0400) !== 0,
    tc: (flags & 0x0200) !== 0,
    rcode: flags & 0xf,
    qdcount: msg.readUInt16BE(4),
    ancount: msg.readUInt16BE(6),
    nscount: msg.readUInt16BE(8),
    arcount: msg.readUInt16BE(10),
  };
  let pos = 12;
  for (let i = 0; i < header.qdcount; i++) {
    pos = readName(msg, pos).next + 4;
    if (pos > msg.length) throw new DnsWireError('Truncated question');
  }
  const answers: DnsRecord[] = [];
  for (let i = 0; i < header.ancount; i++) {
    const { name, next } = readName(msg, pos);
    if (next + 10 > msg.length) throw new DnsWireError('Truncated record');
    const type = msg.readUInt16BE(next);
    const cls = msg.readUInt16BE(next + 2);
    const ttl = msg.readUInt32BE(next + 4);
    const rdlen = msg.readUInt16BE(next + 8);
    const rdStart = next + 10;
    if (rdStart + rdlen > msg.length) {
      throw new DnsWireError('Record data runs past message end');
    }
    answers.push({
      name,
      type,
      class: cls,
      ttl,
      value: formatRdata(msg, type, rdStart, rdlen),
    });
    pos = rdStart + rdlen;
  }
  return { header, answers };
}

/** Renders RDATA in presentation format; unknown or malformed data as RFC 3597 `\#`. */
export function formatRdata(
  msg: Buffer,
  type: number,
  start: number,
  len: number,
): string {
  const end = start + len;
  const rd = msg.subarray(start, end);
  const generic = () =>
    `\\# ${len}${len ? ' ' + rd.toString('hex').toUpperCase() : ''}`;
  try {
    switch (type) {
      case 1:
        if (len !== 4) return generic();
        return Array.from(rd).join('.');
      case 28:
        if (len !== 16) return generic();
        return formatIpv6(rd);
      case 2:
      case 5:
      case 12:
      case 39:
        return nameWithin(msg, start, end).name;
      case 15: {
        if (len < 3) return generic();
        const pref = msg.readUInt16BE(start);
        return `${pref} ${nameWithin(msg, start + 2, end).name}`;
      }
      case 6: {
        const mname = nameWithin(msg, start, end);
        const rname = nameWithin(msg, mname.next, end);
        if (rname.next + 20 !== end) return generic();
        const nums = [0, 4, 8, 12, 16].map((o) =>
          msg.readUInt32BE(rname.next + o),
        );
        return `${mname.name} ${rname.name} ${nums.join(' ')}`;
      }
      case 16:
      case 99:
        return readCharStrings(rd).map(quote).join(' ');
      case 33: {
        if (len < 7) return generic();
        const [prio, weight, port] = [0, 2, 4].map((o) =>
          msg.readUInt16BE(start + o),
        );
        return `${prio} ${weight} ${port} ${nameWithin(msg, start + 6, end).name}`;
      }
      case 257: {
        if (len < 2) return generic();
        const flags = rd[0]!;
        const tagLen = rd[1]!;
        if (2 + tagLen > len) return generic();
        const tag = rd.subarray(2, 2 + tagLen).toString('latin1');
        const value = rd.subarray(2 + tagLen).toString('latin1');
        return `${flags} ${tag} ${quote(value)}`;
      }
      default:
        return generic();
    }
  } catch {
    return generic();
  }
}

/** A name inside RDATA must start (and, uncompressed, end) inside the RDATA. */
function nameWithin(msg: Buffer, start: number, end: number) {
  if (start >= end) throw new DnsWireError('Empty name in record data');
  const res = readName(msg, start);
  if (res.next > end) throw new DnsWireError('Name exceeds record data');
  return res;
}

function readCharStrings(rd: Buffer): string[] {
  const out: string[] = [];
  let pos = 0;
  while (pos < rd.length) {
    const len = rd[pos]!;
    if (pos + 1 + len > rd.length) {
      throw new DnsWireError('Character string past record end');
    }
    out.push(rd.subarray(pos + 1, pos + 1 + len).toString('latin1'));
    pos += 1 + len;
  }
  return out;
}

function quote(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (ch === '"' || ch === '\\') out += '\\' + ch;
    else if (c < 0x20 || c > 0x7e) out += '\\' + String(c).padStart(3, '0');
    else out += ch;
  }
  return `"${out}"`;
}

function formatIpv6(rd: Buffer): string {
  const groups: number[] = [];
  for (let i = 0; i < 16; i += 2) groups.push(rd.readUInt16BE(i));
  // Compress the longest run of zero groups (length >= 2), per RFC 5952.
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8;) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > bestLen && j - i >= 2) {
      bestStart = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (bestStart < 0) return hex.join(':');
  const head = hex.slice(0, bestStart).join(':');
  const tail = hex.slice(bestStart + bestLen).join(':');
  return `${head}::${tail}`;
}
