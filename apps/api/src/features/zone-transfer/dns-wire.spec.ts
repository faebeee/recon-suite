import {
  buildAxfrQuery,
  DnsWireError,
  encodeName,
  formatRdata,
  frameTcp,
  parseMessage,
  readName,
  TcpMessageReader,
} from './dns-wire.js';

const u16 = (n: number) => Buffer.from([n >> 8, n & 0xff]);
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};

function header(id: number, flags: number, qd: number, an: number) {
  return Buffer.concat([u16(id), u16(flags), u16(qd), u16(an), u16(0), u16(0)]);
}

function rr(name: Buffer, type: number, ttl: number, rdata: Buffer) {
  return Buffer.concat([
    name,
    u16(type),
    u16(1),
    u32(ttl),
    u16(rdata.length),
    rdata,
  ]);
}

describe('encodeName / buildAxfrQuery', () => {
  it('encodes labels', () => {
    expect(encodeName('ab.c')).toEqual(Buffer.from([2, 97, 98, 1, 99, 0]));
    expect(encodeName('.')).toEqual(Buffer.from([0]));
  });

  it('rejects oversized labels', () => {
    expect(() => encodeName('a'.repeat(64) + '.com')).toThrow(DnsWireError);
  });

  it('builds an AXFR question', () => {
    const q = buildAxfrQuery('ex.com', 0x1234);
    expect(q.readUInt16BE(0)).toBe(0x1234);
    expect(q.readUInt16BE(4)).toBe(1);
    expect(q.subarray(12)).toEqual(
      Buffer.concat([encodeName('ex.com'), u16(252), u16(1)]),
    );
    expect(frameTcp(q).readUInt16BE(0)).toBe(q.length);
  });
});

describe('readName', () => {
  it('follows compression pointers', () => {
    // offset 0: "ex.com", offset 8: "www" + pointer to 0
    const msg = Buffer.concat([
      encodeName('ex.com'),
      Buffer.from([3, 119, 119, 119, 0xc0, 0x00]),
    ]);
    expect(readName(msg, 8)).toEqual({ name: 'www.ex.com.', next: 14 });
    expect(readName(msg, 0)).toEqual({ name: 'ex.com.', next: 8 });
  });

  it('rejects a pointer loop', () => {
    // pointer at 2 -> 0, label at 0 runs into the pointer at 2 -> ... must not hang
    const self = Buffer.from([0xc0, 0x00]);
    expect(() => readName(self, 0)).toThrow(/loop/);
    const twoStep = Buffer.from([1, 97, 0xc0, 0x00]);
    expect(() => readName(twoStep, 0)).toThrow(/loop/);
  });

  it('rejects names running past the end', () => {
    expect(() => readName(Buffer.from([5, 97, 98]), 0)).toThrow(DnsWireError);
    expect(() => readName(Buffer.from([0xc0]), 0)).toThrow(DnsWireError);
  });

  it('escapes odd bytes', () => {
    expect(readName(Buffer.from([3, 97, 46, 1, 0]), 0).name).toBe('a\\.\\001.');
  });
});

describe('formatRdata', () => {
  const fmt = (type: number, rd: Buffer) => formatRdata(rd, type, 0, rd.length);

  it('formats common types', () => {
    expect(fmt(1, Buffer.from([192, 0, 2, 1]))).toBe('192.0.2.1');
    expect(
      fmt(28, Buffer.from('20010db8000000000000000000000001', 'hex')),
    ).toBe('2001:db8::1');
    expect(
      fmt(28, Buffer.from('20010db8000100020003000400050006', 'hex')),
    ).toBe('2001:db8:1:2:3:4:5:6');
    expect(fmt(16, Buffer.from([2, 104, 105, 3, 34, 120, 92]))).toBe(
      '"hi" "\\"x\\\\"',
    );
    expect(fmt(15, Buffer.concat([u16(10), encodeName('mx.ex.com')]))).toBe(
      '10 mx.ex.com.',
    );
    expect(
      fmt(33, Buffer.concat([u16(1), u16(5), u16(443), encodeName('s.ex')])),
    ).toBe('1 5 443 s.ex.');
    expect(
      fmt(
        257,
        Buffer.concat([
          Buffer.from([0, 5]),
          Buffer.from('issueletsencrypt.org'),
        ]),
      ),
    ).toBe('0 issue "letsencrypt.org"');
    expect(
      fmt(
        6,
        Buffer.concat([
          encodeName('ns.ex'),
          encodeName('hm.ex'),
          u32(2024010101),
          u32(7200),
          u32(3600),
          u32(1209600),
          u32(300),
        ]),
      ),
    ).toBe('ns.ex. hm.ex. 2024010101 7200 3600 1209600 300');
  });

  it('uses the generic form for unknown or malformed data', () => {
    expect(fmt(99_99, Buffer.from([0xab, 0x01]))).toBe('\\# 2 AB01');
    expect(fmt(1, Buffer.from([1, 2, 3]))).toBe('\\# 3 010203');
    expect(fmt(5, Buffer.from([0xc0, 0x00]))).toMatch(/^\\# 2/);
  });
});

describe('parseMessage', () => {
  it('decodes an AXFR answer with compression', () => {
    const qname = encodeName('ex.com'); // at offset 12
    const ptr = Buffer.from([0xc0, 12]);
    const soa = Buffer.concat([
      Buffer.from([2, 110, 115, 0xc0, 12]), // ns.ex.com
      Buffer.from([2, 104, 109, 0xc0, 12]),
      u32(1),
      u32(2),
      u32(3),
      u32(4),
      u32(5),
    ]);
    const msg = Buffer.concat([
      header(7, 0x8400, 1, 3),
      qname,
      u16(252),
      u16(1),
      rr(ptr, 6, 3600, soa),
      rr(
        Buffer.from([3, 119, 119, 119, 0xc0, 12]),
        1,
        60,
        Buffer.from([10, 0, 0, 1]),
      ),
      rr(ptr, 6, 3600, soa),
    ]);
    const parsed = parseMessage(msg);
    expect(parsed.header).toMatchObject({
      id: 7,
      qr: true,
      aa: true,
      rcode: 0,
    });
    expect(parsed.answers.map((a) => [a.name, a.type, a.ttl, a.value])).toEqual(
      [
        ['ex.com.', 6, 3600, 'ns.ex.com. hm.ex.com. 1 2 3 4 5'],
        ['www.ex.com.', 1, 60, '10.0.0.1'],
        ['ex.com.', 6, 3600, 'ns.ex.com. hm.ex.com. 1 2 3 4 5'],
      ],
    );
  });

  it('reads the rcode and throws on truncated records', () => {
    expect(parseMessage(header(1, 0x8005, 0, 0)).header.rcode).toBe(5);
    const bad = Buffer.concat([
      header(1, 0x8000, 0, 1),
      Buffer.from([0, 0, 1]),
    ]);
    expect(() => parseMessage(bad)).toThrow(DnsWireError);
    expect(() => parseMessage(Buffer.alloc(5))).toThrow(DnsWireError);
  });

  it('survives a malicious pointer loop in a record name', () => {
    const loop = Buffer.concat([
      header(1, 0x8000, 0, 1),
      Buffer.from([0xc0, 12]),
    ]);
    expect(() => parseMessage(loop)).toThrow(/loop/);
  });
});

describe('TcpMessageReader', () => {
  it('reassembles split frames', () => {
    const r = new TcpMessageReader();
    const a = frameTcp(Buffer.from('hello'));
    const b = frameTcp(Buffer.from('xy'));
    const all = Buffer.concat([a, b]);
    expect(r.push(all.subarray(0, 3))).toEqual([]);
    expect(r.push(all.subarray(3)).map(String)).toEqual(['hello', 'xy']);
  });
});
