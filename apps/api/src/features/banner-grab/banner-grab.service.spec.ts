import { ForbiddenException } from '@nestjs/common';
import { createServer, type Server, type Socket } from 'node:net';
import type { TargetGuardService } from '../../core/net/target-guard.service.js';
import { BannerGrabService, grabBanner } from './banner-grab.service.js';

const sockets = new Set<Socket>();
const listen = async (onConnection: (s: Socket) => void) => {
  const server = createServer((s) => {
    sockets.add(s);
    onConnection(s);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: (server.address() as { port: number }).port };
};
const close = (server: Server) => {
  for (const s of sockets) s.destroy();
  return new Promise<void>((r) => server.close(() => r()));
};

describe('grabBanner', () => {
  const servers: Server[] = [];
  afterAll(() => Promise.all(servers.map(close)));

  it('reads a greeting without writing anything', async () => {
    const received: Buffer[] = [];
    const { server, port } = await listen((s) => {
      s.on('data', (d: Buffer) => received.push(d));
      s.write('220 mail.test ESMTP Postfix\r\n');
    });
    servers.push(server);
    const out = await grabBanner({
      host: '127.0.0.1',
      port,
      timeoutMs: 1000,
      tls: false,
    });
    expect(out).toMatchObject({
      port,
      state: 'banner',
      tls: false,
      service: 'smtp',
      product: 'Postfix',
      banner: '220 mail.test ESMTP Postfix',
    });
    expect(received).toHaveLength(0);
  });

  it('collects multi-line greetings sent in several chunks', async () => {
    const { server, port } = await listen((s) => {
      s.write('220-FileZilla Server 1.7.0\r\n');
      setTimeout(() => s.write('220 Welcome\r\n'), 50);
    });
    servers.push(server);
    const out = await grabBanner({
      host: '127.0.0.1',
      port,
      timeoutMs: 1000,
      tls: false,
    });
    expect(out.banner).toBe('220-FileZilla Server 1.7.0\n220 Welcome');
    expect(out.version).toBe('1.7.0');
  });

  it('reports silent services', async () => {
    const { server, port } = await listen(() => undefined);
    servers.push(server);
    const out = await grabBanner({
      host: '127.0.0.1',
      port,
      timeoutMs: 500,
      tls: false,
    });
    expect(out).toEqual({ port, state: 'silent', tls: false });
  });

  it('reports closed ports', async () => {
    const { server, port } = await listen(() => undefined);
    await close(server);
    const out = await grabBanner({
      host: '127.0.0.1',
      port,
      timeoutMs: 500,
      tls: false,
    });
    expect(out.state).toBe('closed');
  });

  it('reports an error when the TLS handshake fails', async () => {
    const { server, port } = await listen((s) => s.end('not tls\r\n'));
    servers.push(server);
    const out = await grabBanner({
      host: '127.0.0.1',
      port,
      timeoutMs: 1000,
      tls: true,
    });
    expect(out.state).toBe('error');
    expect(out.tls).toBe(true);
    expect(out.error).toBeTruthy();
  });
});

describe('BannerGrabService', () => {
  it('connects to the address returned by the guard and dedupes ports', async () => {
    const { server, port } = await listen((s) =>
      s.end('SSH-2.0-OpenSSH_9.6\r\n'),
    );
    const resolve = vi.fn(async (host: string) => ({
      host,
      addresses: ['127.0.0.1'],
    }));
    const guard = { resolve } as unknown as TargetGuardService;
    const out = await new BannerGrabService(guard).grab({
      target: 'scan.test',
      ports: [port, port],
      timeoutMs: 1000,
    });
    await close(server);
    expect(resolve).toHaveBeenCalledWith('scan.test');
    expect(out.address).toBe('127.0.0.1');
    expect(out.results).toEqual([
      expect.objectContaining({
        port,
        state: 'banner',
        product: 'OpenSSH',
        version: '9.6',
      }),
    ]);
  });

  it('rejects blocked targets', async () => {
    const guard = {
      resolve: vi.fn(async () => {
        throw new ForbiddenException('blocked');
      }),
    } as unknown as TargetGuardService;
    await expect(
      new BannerGrabService(guard).grab({
        target: '10.0.0.1',
        ports: [22],
        timeoutMs: 500,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
