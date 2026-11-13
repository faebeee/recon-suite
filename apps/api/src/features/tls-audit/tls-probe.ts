import { connect, createSecureContext, getCiphers } from 'node:tls';
import type { TlsProtocolVersion } from '@recon/shared';
import { formatKeyExchange } from './tls-audit.report.js';

export interface ProbeOptions {
  /** Already validated IP address. */
  address: string;
  port: number;
  servername?: string;
  version?: TlsProtocolVersion;
  ciphers?: string;
  requestOCSP?: boolean;
  timeoutMs: number;
}

export type ProbeResult =
  | {
      ok: true;
      protocol: string;
      cipher: { name: string; standardName?: string };
      keyExchange?: string;
      ocspStapled?: boolean;
      certificateDer?: Buffer;
    }
  | {
      ok: false;
      /** The local TLS library refused before anything was sent to the server. */
      local: boolean;
      /** TCP level failure (refused, unreachable, timeout). */
      network: boolean;
      message: string;
    };

export type Probe = (opts: ProbeOptions) => Promise<ProbeResult>;

const LOCAL_CODES = new Set([
  'ERR_SSL_NO_PROTOCOLS_AVAILABLE',
  'ERR_SSL_NO_CIPHER_MATCH',
  'ERR_SSL_NO_CIPHERS_AVAILABLE',
  'ERR_TLS_INVALID_PROTOCOL_VERSION',
]);
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'TIMEOUT',
]);

/** Legacy suites that OpenSSL may still support with @SECLEVEL=0 (not in getCiphers()). */
const LEGACY_CANDIDATES = [
  'NULL-MD5',
  'NULL-SHA',
  'NULL-SHA256',
  'ECDHE-RSA-NULL-SHA',
  'ECDHE-ECDSA-NULL-SHA',
  'EXP-RC4-MD5',
  'EXP-DES-CBC-SHA',
  'RC4-MD5',
  'RC4-SHA',
  'ECDHE-RSA-RC4-SHA',
  'DES-CBC-SHA',
  'DES-CBC3-SHA',
  'ECDHE-RSA-DES-CBC3-SHA',
  'EDH-RSA-DES-CBC3-SHA',
  'ADH-AES128-SHA',
  'ADH-AES256-GCM-SHA384',
  'AECDH-AES128-SHA',
  'CAMELLIA128-SHA',
  'CAMELLIA256-SHA',
  'DHE-RSA-CAMELLIA128-SHA',
  'ECDHE-ARIA128-GCM-SHA256',
  'ECDHE-RSA-ARIA128-GCM-SHA256',
];

export const TLS13_SUITES = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
];

let cachedCandidates: string[] | undefined;

/** TLS <= 1.2 cipher suites (OpenSSL names) the local OpenSSL can offer. */
export function candidateCiphers(): string[] {
  if (cachedCandidates) return cachedCandidates;
  const fromNode = getCiphers()
    .map((c) => c.toUpperCase())
    .filter((c) => !/^TLS_|PSK|SRP/.test(c));
  cachedCandidates = [...new Set([...fromNode, ...LEGACY_CANDIDATES])].filter(
    (c) => {
      try {
        createSecureContext({ ciphers: `${c}:@SECLEVEL=0` });
        return true;
      } catch {
        return false;
      }
    },
  );
  return cachedCandidates;
}

/** One TLS handshake; never throws. */
export const tlsProbe: Probe = (opts) =>
  new Promise((resolve) => {
    let settled = false;
    let ocsp: boolean | undefined;
    const done = (r: ProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve(r);
    };
    const fail = (code: string, message: string) =>
      done({
        ok: false,
        local: LOCAL_CODES.has(code),
        network: NETWORK_CODES.has(code),
        message,
      });

    const timer = setTimeout(
      () => fail('TIMEOUT', `Handshake timed out after ${opts.timeoutMs} ms`),
      opts.timeoutMs,
    );

    let socket: ReturnType<typeof connect> | undefined;
    try {
      socket = connect({
        host: opts.address,
        port: opts.port,
        servername: opts.servername,
        // Configuration audit, not a trust check (the TLS Inspector reports trust).
        rejectUnauthorized: false,
        minVersion: opts.version,
        maxVersion: opts.version,
        ciphers: opts.ciphers,
        requestOCSP: opts.requestOCSP,
      });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      done({
        ok: false,
        local: true,
        network: false,
        message: e.code ?? e.message,
      });
      return;
    }
    // Emitted with null/empty when the server staples nothing.
    socket.on('OCSPResponse', (res: Buffer | null) => {
      ocsp = !!res && res.length > 0;
    });
    socket.once('secureConnect', () => {
      const s = socket!;
      const cipher = s.getCipher();
      const cert = opts.requestOCSP ? s.getPeerX509Certificate() : undefined;
      done({
        ok: true,
        protocol: s.getProtocol() ?? '',
        cipher: { name: cipher.name, standardName: cipher.standardName },
        keyExchange: formatKeyExchange(s.getEphemeralKeyInfo()),
        ocspStapled: opts.requestOCSP ? (ocsp ?? false) : undefined,
        certificateDer: cert?.raw,
      });
    });
    socket.once('error', (err: NodeJS.ErrnoException) =>
      fail(err.code ?? '', err.code ?? err.message),
    );
  });
