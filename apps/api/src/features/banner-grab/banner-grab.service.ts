import { Injectable } from '@nestjs/common';
import { isIP, Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import {
  IMPLICIT_TLS_PORTS,
  type BannerGrabOutput,
  type BannerGrabParams,
  type BannerResult,
} from '@recon/shared';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import { parseBanner } from './banner.parser.js';

const CONCURRENCY = 4;
/** After the first chunk, keep collecting this long for multi-line greetings. */
const COLLECT_MS = 300;
const MAX_BYTES = 4096;

export interface GrabOptions {
  host: string;
  port: number;
  timeoutMs: number;
  tls: boolean;
  /** SNI name; only for hostnames, never IP literals. */
  servername?: string;
}

/**
 * Active: connects to each port and only listens. Nothing is ever written to the socket
 * (apart from the TLS handshake on implicit-TLS ports), so only services that speak first
 * produce a banner.
 */
@Injectable()
export class BannerGrabService {
  constructor(private readonly guard: TargetGuardService) {}

  async grab({
    target,
    ports,
    timeoutMs,
  }: BannerGrabParams): Promise<BannerGrabOutput> {
    const { addresses } = await this.guard.resolve(target);
    const address = addresses[0]!;
    const servername = isIP(target) ? undefined : target;
    const unique = [...new Set(ports)].sort((a, b) => a - b);

    const results = await mapConcurrent(unique, CONCURRENCY, (port) =>
      grabBanner({
        host: address,
        port,
        timeoutMs,
        tls: IMPLICIT_TLS_PORTS.includes(port),
        servername,
      }),
    );
    return { address, results };
  }
}

/** Connects (plain or implicit TLS), waits for the server's greeting and closes again. */
export function grabBanner(opts: GrabOptions): Promise<BannerResult> {
  const { host, port, timeoutMs, tls, servername } = opts;
  return new Promise((resolve) => {
    const raw = new Socket();
    let stream: Socket | TLSSocket = raw;
    let connected = false;
    let settled = false;
    const chunks: Buffer[] = [];
    let size = 0;
    let timer: NodeJS.Timeout | undefined;

    const finish = (
      result: Omit<BannerResult, 'port' | 'tls'>,
      data?: Buffer,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stream.destroy();
      raw.destroy();
      const parsed = data?.length ? parseBanner(data, port) : undefined;
      resolve({ port, tls, ...result, ...parsed });
    };
    const finishWithData = () =>
      chunks.length
        ? finish(
            { state: 'banner' },
            Buffer.concat(chunks).subarray(0, MAX_BYTES),
          )
        : finish({ state: 'silent' });

    const onError = (err: NodeJS.ErrnoException) => {
      if (!connected) {
        finish({
          state: err.code === 'ECONNREFUSED' ? 'closed' : 'filtered',
        });
      } else if (chunks.length) {
        finishWithData();
      } else {
        finish({ state: 'error', error: describeError(err, tls) });
      }
    };

    const listen = () => {
      // Phase 2: connected (and handshaken); wait for the first byte.
      clearTimeout(timer);
      timer = setTimeout(finishWithData, timeoutMs);
      stream.on('data', (chunk: Buffer) => {
        if (!chunks.length) {
          clearTimeout(timer);
          timer = setTimeout(finishWithData, COLLECT_MS);
        }
        chunks.push(chunk);
        size += chunk.length;
        if (size >= MAX_BYTES) finishWithData();
      });
      stream.once('end', finishWithData);
      stream.once('close', finishWithData);
    };

    // Phase 1: TCP connect (and TLS handshake), bounded by timeoutMs.
    timer = setTimeout(
      () =>
        connected
          ? finish({ state: 'error', error: 'TLS handshake timed out' })
          : finish({ state: 'filtered' }),
      timeoutMs,
    );
    raw.once('error', onError);
    raw.once('connect', () => {
      connected = true;
      if (!tls) return listen();
      const secure = tlsConnect({
        socket: raw,
        servername,
        // Certificate problems are the TLS tool's job; we only want the greeting.
        rejectUnauthorized: false,
      });
      stream = secure;
      secure.once('error', onError);
      secure.once('secureConnect', listen);
    });
    raw.connect(port, host);
  });
}

function describeError(err: NodeJS.ErrnoException, tls: boolean): string {
  if (err.code === 'ECONNRESET') {
    return tls
      ? 'Connection reset during the TLS handshake'
      : 'Connection reset by the server';
  }
  return err.message || err.code || 'Connection failed';
}
