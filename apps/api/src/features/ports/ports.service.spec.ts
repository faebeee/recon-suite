import { createServer, type Server } from 'node:net';
import { probe } from './ports.service.js';

describe('probe', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((s) => s.end());
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('detects an open port', async () => {
    expect((await probe('127.0.0.1', port, 1000)).state).toBe('open');
  });

  it('detects a closed port', async () => {
    const closed = port === 65535 ? port - 1 : port + 1;
    expect((await probe('127.0.0.1', closed, 1000)).state).toBe('closed');
  });
});
