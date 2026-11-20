import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { TargetGuardService } from '../net/target-guard.service.js';
import { HttpClientService } from './http-client.service.js';

describe('HttpClientService.targetRaw', () => {
  let server: Server;
  let base: string;
  const http = new HttpClientService(new TargetGuardService());

  beforeAll(async () => {
    // Echoes TRACE like a misconfigured server; streams a large body otherwise.
    server = createServer((req, res) => {
      if (req.method === 'TRACE') {
        res.setHeader('content-type', 'message/http');
        res.end(
          `TRACE ${req.url} HTTP/1.1\r\nx-marker: ${String(req.headers['x-marker'])}\r\n`,
        );
        return;
      }
      res.end('x'.repeat(200_000));
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await http.onModuleDestroy();
    await new Promise((r) => server.close(r));
  });

  it('sends TRACE, which fetch() refuses', async () => {
    const res = await http.targetRaw(`${base}/`, {
      method: 'TRACE',
      headers: { 'x-marker': 'abc' },
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('message/http');
    expect(res.body).toContain('x-marker: abc');
  });

  it('cuts the body at maxBytes', async () => {
    const res = await http.targetRaw(`${base}/`, {
      method: 'GET',
      maxBytes: 1000,
    });
    expect(res.body).toHaveLength(1000);
  });
});
