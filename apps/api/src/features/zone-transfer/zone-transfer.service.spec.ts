import { NotFoundException } from '@nestjs/common';
import { createServer, type Server, type Socket } from 'node:net';
import type { TargetGuardService } from '../../core/net/target-guard.service.js';
import { encodeName, frameTcp, TcpMessageReader } from './dns-wire.js';
import { ZoneTransferService } from './zone-transfer.service.js';

const u16 = (n: number) => Buffer.from([n >> 8, n & 0xff]);
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const rr = (name: Buffer, type: number, rdata: Buffer) =>
  Buffer.concat([name, u16(type), u16(1), u32(300), u16(rdata.length), rdata]);

type Mode = 'allow' | 'refuse' | 'close';

/** Fake authoritative server: answers AXFR in two TCP messages, or refuses. */
function answer(query: Buffer, mode: Mode): Buffer[] {
  const id = query.readUInt16BE(0);
  const question = query.subarray(12);
  if (mode === 'refuse') {
    return [
      Buffer.concat([
        u16(id),
        u16(0x8005),
        u16(1),
        u16(0),
        u16(0),
        u16(0),
        question,
      ]),
    ];
  }
  const apex = Buffer.from([0xc0, 12]);
  const soa = rr(
    apex,
    6,
    Buffer.concat([
      encodeName('ns1.zone.test'),
      encodeName('admin.zone.test'),
      u32(1),
      u32(2),
      u32(3),
      u32(4),
      u32(5),
    ]),
  );
  const hdr = (an: number) =>
    Buffer.concat([u16(id), u16(0x8400), u16(1), u16(an), u16(0), u16(0)]);
  return [
    Buffer.concat([
      hdr(2),
      question,
      soa,
      rr(apex, 1, Buffer.from([192, 0, 2, 10])),
    ]),
    Buffer.concat([
      hdr(2),
      question,
      rr(
        Buffer.concat([Buffer.from([3, 100, 101, 118]), apex]),
        16,
        Buffer.from([3, 97, 98, 99]),
      ),
      soa,
    ]),
  ];
}

describe('ZoneTransferService', () => {
  let server: Server;
  let port: number;
  let mode: Mode = 'allow';

  beforeAll(async () => {
    server = createServer((s: Socket) => {
      const reader = new TcpMessageReader();
      s.on('data', (chunk) => {
        for (const q of reader.push(chunk)) {
          if (mode === 'close') return void s.end();
          for (const m of answer(q, mode)) s.write(frameTcp(m));
        }
      });
      s.on('error', () => undefined);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const guard = (blocked: string[] = []) =>
    ({
      resolve: vi.fn(async (host: string) => {
        if (blocked.includes(host))
          throw new NotFoundException(`${host} does not resolve`);
        return { host, addresses: ['127.0.0.1'] };
      }),
    }) as unknown as TargetGuardService;

  const service = (ns: string[], g = guard()) => {
    const s = new ZoneTransferService(g);
    s.lookupNs = vi.fn(async () => ns);
    s.port = port;
    s.timeoutMs = 2000;
    return s;
  };

  it('receives a zone and reports a failing finding', async () => {
    mode = 'allow';
    const out = await service(['NS1.zone.test.']).transfer({
      target: 'zone.test',
    });
    expect(out.attempts).toHaveLength(1);
    const a = out.attempts[0]!;
    expect(a).toMatchObject({
      nameserver: 'ns1.zone.test',
      address: '127.0.0.1',
      status: 'allowed',
      recordCount: 4,
      truncated: false,
    });
    expect(a.records?.map((r) => `${r.name} ${r.type} ${r.value}`)).toEqual([
      'zone.test. SOA ns1.zone.test. admin.zone.test. 1 2 3 4 5',
      'zone.test. A 192.0.2.10',
      'dev.zone.test. TXT "abc"',
      'zone.test. SOA ns1.zone.test. admin.zone.test. 1 2 3 4 5',
    ]);
    expect(out.findings).toEqual([
      expect.objectContaining({ status: 'fail', id: 'axfr.ns1.zone.test' }),
    ]);
  });

  it('reports refused transfers and guard errors per nameserver', async () => {
    mode = 'refuse';
    const out = await service(
      ['b.zone.test', 'a.zone.test'],
      guard(['b.zone.test']),
    ).transfer({ target: 'zone.test' });
    expect(out.attempts.map((a) => [a.nameserver, a.status])).toEqual([
      ['a.zone.test', 'refused'],
      ['b.zone.test', 'error'],
    ]);
    expect(out.attempts[1]!.error).toMatch(/does not resolve/);
    expect(out.findings).toEqual([expect.objectContaining({ status: 'pass' })]);
  });

  it('treats a closed connection as refused', async () => {
    mode = 'close';
    const out = await service(['a.zone.test']).transfer({
      target: 'zone.test',
    });
    expect(out.attempts[0]).toMatchObject({ status: 'refused' });
  });

  it('throws 404 when there are no nameservers', async () => {
    await expect(
      service([]).transfer({ target: 'www.zone.test' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
