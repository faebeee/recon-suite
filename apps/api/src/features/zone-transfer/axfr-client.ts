import { connect } from 'node:net';
import { randomInt } from 'node:crypto';
import { MAX_ZONE_RECORDS, type ZoneRecord } from '@recon/shared';
import {
  buildAxfrQuery,
  frameTcp,
  parseMessage,
  RCODE,
  TcpMessageReader,
  typeName,
} from './dns-wire.js';

export const MAX_TRANSFER_BYTES = 5 * 1024 * 1024;

export interface AxfrResult {
  status: 'allowed' | 'refused' | 'timeout' | 'error';
  error?: string;
  recordCount?: number;
  records?: ZoneRecord[];
  truncated?: boolean;
}

const REFUSING_RCODES = new Set<number>([
  RCODE.REFUSED,
  RCODE.NOTAUTH,
  RCODE.NOTIMP,
]);
const RCODE_NAMES: Record<number, string> = {
  1: 'FORMERR',
  2: 'SERVFAIL',
  3: 'NXDOMAIN',
  4: 'NOTIMP',
  5: 'REFUSED',
  9: 'NOTAUTH',
};

/**
 * Requests a zone transfer from `address` (an IP already checked by TargetGuard).
 * Never throws: every outcome is reported as an `AxfrResult`.
 */
export function axfr(
  address: string,
  domain: string,
  { port = 53, timeoutMs = 10_000 } = {},
): Promise<AxfrResult> {
  return new Promise((resolve) => {
    const id = randomInt(0, 0x10000);
    const reader = new TcpMessageReader();
    const records: ZoneRecord[] = [];
    let count = 0;
    let soaSeen = 0;
    let received = 0;
    let settled = false;

    const socket = connect({ host: address, port });
    const timer = setTimeout(() => {
      finish(
        count > 0
          ? partial('Transfer timed out before the closing SOA')
          : {
              status: 'timeout',
              error: `No answer within ${timeoutMs / 1000} s`,
            },
      );
    }, timeoutMs);

    function partial(reason: string): AxfrResult {
      return {
        status: 'allowed',
        error: reason,
        recordCount: count,
        records,
        truncated: true,
      };
    }

    function finish(result: AxfrResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    }

    socket.on('connect', () => {
      socket.write(frameTcp(buildAxfrQuery(domain, id)));
    });

    socket.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_TRANSFER_BYTES) {
        finish(partial('Transfer aborted after 5 MB'));
        return;
      }
      let messages: Buffer[];
      try {
        messages = reader.push(chunk);
        for (const raw of messages) {
          const msg = parseMessage(raw);
          if (msg.header.id !== id || !msg.header.qr) continue;
          const { rcode } = msg.header;
          if (rcode !== RCODE.NOERROR) {
            const name = RCODE_NAMES[rcode] ?? `RCODE ${rcode}`;
            if (count > 0) return finish(partial(`Server sent ${name}`));
            return finish(
              REFUSING_RCODES.has(rcode)
                ? { status: 'refused', error: `Server answered ${name}` }
                : { status: 'error', error: `Server answered ${name}` },
            );
          }
          if (msg.answers.length === 0 && count === 0) {
            return finish({
              status: 'refused',
              error: 'Server answered without any records',
            });
          }
          for (const rr of msg.answers) {
            count++;
            if (records.length < MAX_ZONE_RECORDS) {
              records.push({
                name: rr.name,
                type: typeName(rr.type),
                ttl: rr.ttl,
                value: rr.value,
              });
            }
            if (rr.type === 6 && ++soaSeen === 2) {
              return finish({
                status: 'allowed',
                recordCount: count,
                records,
                truncated: count > records.length,
              });
            }
          }
        }
      } catch (err) {
        const reason = `Malformed response: ${(err as Error).message}`;
        finish(
          count > 0 ? partial(reason) : { status: 'error', error: reason },
        );
      }
    });

    socket.on('error', (err: NodeJS.ErrnoException) => {
      if (count > 0) return finish(partial(`Connection error: ${err.message}`));
      if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
        return finish({
          status: 'refused',
          error:
            err.code === 'ECONNREFUSED'
              ? 'TCP port 53 refused the connection'
              : 'Connection reset without an answer',
        });
      }
      finish({ status: 'error', error: err.message });
    });

    socket.on('close', () => {
      finish(
        count > 0
          ? partial('Connection closed before the closing SOA')
          : { status: 'refused', error: 'Connection closed without an answer' },
      );
    });
  });
}
