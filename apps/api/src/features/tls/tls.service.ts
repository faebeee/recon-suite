import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { isIP } from 'node:net';
import { connect, type TLSSocket } from 'node:tls';
import type { TlsOutput, TlsParams } from '@recon/shared';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
import { toCertificateInfo, walkChain } from './certificate.mapper.js';

const TIMEOUT_MS = 8000;

@Injectable()
export class TlsService {
  constructor(private readonly guard: TargetGuardService) {}

  async inspect({ target, port }: TlsParams): Promise<TlsOutput> {
    const { addresses } = await this.guard.resolve(target);
    const address = addresses[0]!;
    const socket = await this.handshake(
      address,
      port,
      isIP(target) ? undefined : target,
    );

    try {
      const peer = socket.getPeerCertificate(true);
      if (!peer || !peer.fingerprint256) {
        throw new BadGatewayException('Server did not present a certificate');
      }
      const [leaf, ...chain] = walkChain(peer).map((c) => toCertificateInfo(c));
      const cipher = socket.getCipher();
      return {
        address,
        port,
        protocol: socket.getProtocol(),
        cipher: {
          name: cipher.name,
          standardName: cipher.standardName,
          version: cipher.version,
        },
        authorized: socket.authorized,
        authorizationError: socket.authorizationError
          ? String(socket.authorizationError)
          : undefined,
        certificate: leaf!,
        chain,
      };
    } finally {
      socket.destroy();
    }
  }

  private handshake(
    host: string,
    port: number,
    servername?: string,
  ): Promise<TLSSocket> {
    return new Promise((resolve, reject) => {
      // Connect to the already-validated IP; SNI carries the hostname.
      const socket = connect({
        host,
        port,
        servername,
        rejectUnauthorized: false,
      });
      socket.setTimeout(TIMEOUT_MS, () => {
        socket.destroy();
        reject(
          new GatewayTimeoutException(
            `TLS handshake with ${host}:${port} timed out`,
          ),
        );
      });
      socket.once('secureConnect', () => resolve(socket));
      socket.once('error', (err: NodeJS.ErrnoException) => {
        socket.destroy();
        reject(
          new BadGatewayException(
            `TLS connection to ${host}:${port} failed: ${err.code ?? err.message}`,
          ),
        );
      });
    });
  }
}
