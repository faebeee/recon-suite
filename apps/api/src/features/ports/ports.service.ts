import { Injectable } from '@nestjs/common';
import { Socket } from 'node:net';
import {
  WELL_KNOWN_PORTS,
  type PortResult,
  type PortsOutput,
  type PortsParams,
} from '@recon/shared';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';

const CONCURRENCY = 16;

@Injectable()
export class PortsService {
  constructor(private readonly guard: TargetGuardService) {}

  async scan({ target, ports, timeoutMs }: PortsParams): Promise<PortsOutput> {
    const { addresses } = await this.guard.resolve(target);
    const address = addresses[0]!;
    const unique = [...new Set(ports)].sort((a, b) => a - b);

    const results = await mapConcurrent(unique, CONCURRENCY, (port) =>
      probe(address, port, timeoutMs),
    );
    return {
      address,
      open: results.filter((r) => r.state === 'open').length,
      results,
    };
  }
}

/** Plain TCP connect check: open = handshake completed, closed = RST, filtered = no answer. */
export function probe(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<PortResult> {
  const service = WELL_KNOWN_PORTS[port];
  return new Promise((resolve) => {
    const socket = new Socket();
    const t0 = performance.now();
    const done = (result: Omit<PortResult, 'port' | 'service'>) => {
      socket.destroy();
      resolve({ port, service, ...result });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () =>
      done({ state: 'open', latencyMs: Math.round(performance.now() - t0) }),
    );
    socket.once('timeout', () => done({ state: 'filtered' }));
    socket.once('error', (err: NodeJS.ErrnoException) =>
      done({ state: err.code === 'ECONNREFUSED' ? 'closed' : 'filtered' }),
    );
    socket.connect(port, host);
  });
}
