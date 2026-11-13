import { isIP } from 'node:net';

/** True for 127.0.0.0/8, ::1 and IPv4-mapped loopback. */
export function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  const a = address.replace(/^::ffff:/i, '');
  if (isIP(a) === 4) return a.startsWith('127.');
  return a === '::1';
}

/** Socket peer address; `X-Forwarded-For` is deliberately ignored (no trusted proxy). */
export function peerAddress(req: {
  socket?: { remoteAddress?: string };
}): string | undefined {
  return req.socket?.remoteAddress;
}
