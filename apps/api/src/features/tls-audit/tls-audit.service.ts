import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { isIP } from 'node:net';
import {
  TLS_PROTOCOLS,
  type TlsAuditOutput,
  type TlsAuditParams,
  type TlsCipherResult,
  type TlsProtocolResult,
  type TlsProtocolVersion,
} from '@recon/shared';
import { TargetGuardService } from '../../core/net/target-guard.service.js';
import { mapConcurrent } from '../../core/util/map-concurrent.js';
import { classifyCipher, isTls12Only } from './tls-audit.classify.js';
import { buildTlsReport, hasEmbeddedScts } from './tls-audit.report.js';
import {
  candidateCiphers,
  TLS13_SUITES,
  tlsProbe,
  type Probe,
  type ProbeOptions,
} from './tls-probe.js';

const HANDSHAKE_TIMEOUT_MS = 5000;
const CONCURRENCY = 6;
const BUDGET_MS = 90_000;
/** Lets old OpenSSL suites and protocols be offered for testing. */
const LEGACY = '@SECLEVEL=0';

@Injectable()
export class TlsAuditService {
  /** Handshake implementation; replaced by a fake in tests. */
  probe: Probe = tlsProbe;
  /** TLS <= 1.2 candidate suites; replaceable in tests. */
  candidates: () => string[] = candidateCiphers;
  budgetMs = BUDGET_MS;

  constructor(private readonly guard: TargetGuardService) {}

  async audit({ target, port }: TlsAuditParams): Promise<TlsAuditOutput> {
    const { addresses } = await this.guard.resolve(target);
    const address = addresses[0]!;
    const base = {
      address,
      port,
      servername: isIP(target) ? undefined : target,
      timeoutMs: HANDSHAKE_TIMEOUT_MS,
    };
    const deadline = Date.now() + this.budgetMs;

    const probes = await Promise.all(
      TLS_PROTOCOLS.map((version) =>
        this.probe({
          ...base,
          version,
          ciphers: isLegacy(version) ? `DEFAULT:${LEGACY}` : undefined,
        }),
      ),
    );
    const protocols: TlsProtocolResult[] = TLS_PROTOCOLS.map((version, i) => {
      const r = probes[i]!;
      if (r.ok) return { version, supported: true };
      return r.local
        ? {
            version,
            supported: false,
            error: `Not testable with this server's OpenSSL build (${r.message})`,
          }
        : { version, supported: false };
    });

    if (!probes.some((p) => p.ok)) {
      const failures = probes.filter((p) => !p.ok);
      const where = `${target}:${port}`;
      if (failures.every((f) => f.network)) {
        const timedOut = failures.some((f) => /timed out/i.test(f.message));
        throw timedOut
          ? new GatewayTimeoutException(`Connection to ${where} timed out`)
          : new BadGatewayException(
              `Could not connect to ${where}: ${failures[0]?.message ?? 'unknown error'}`,
            );
      }
      throw new BadGatewayException(
        `No TLS handshake succeeded with ${where}. Either TLS is not served on this port, ` +
          'or the server only accepts suites this OpenSSL build can no longer offer (e.g. RC4, 3DES, export).',
      );
    }

    const supported = protocols
      .filter((p) => p.supported)
      .map((p) => p.version);
    const jobs: { protocol: TlsProtocolVersion; opts: ProbeOptions }[] = [];
    for (const protocol of supported) {
      if (protocol === 'TLSv1.3') {
        for (const suite of TLS13_SUITES) {
          jobs.push({
            protocol,
            opts: { ...base, version: protocol, ciphers: suite },
          });
        }
        continue;
      }
      for (const c of this.candidates()) {
        if (protocol !== 'TLSv1.2' && isTls12Only(c)) continue;
        jobs.push({
          protocol,
          opts: { ...base, version: protocol, ciphers: `${c}:${LEGACY}` },
        });
      }
    }

    let incomplete = false;
    const accepted = await mapConcurrent(jobs, CONCURRENCY, async (job) => {
      if (Date.now() > deadline) {
        incomplete = true;
        return undefined;
      }
      const r = await this.probe(job.opts);
      if (!r.ok) return undefined;
      const { strength, notes } = classifyCipher(r.cipher.name, job.protocol);
      const result: TlsCipherResult = {
        protocol: job.protocol,
        name: r.cipher.name,
        standardName: r.cipher.standardName,
        strength,
        notes,
      };
      return result;
    });
    const ciphers = dedupe(
      accepted.filter((c): c is TlsCipherResult => c !== undefined),
    );

    // Best handshake: highest protocol, default suites, with OCSP stapling requested.
    const best = supported[supported.length - 1]!;
    const detail = await this.probe({
      ...base,
      version: best,
      ciphers: isLegacy(best) ? `DEFAULT:${LEGACY}` : undefined,
      requestOCSP: true,
    });
    const ocspStapling = detail.ok ? (detail.ocspStapled ?? false) : null;
    const certificateTransparency =
      detail.ok && detail.certificateDer
        ? hasEmbeddedScts(detail.certificateDer)
        : null;

    return {
      address,
      port,
      protocols,
      ciphers,
      ocspStapling,
      certificateTransparency,
      keyExchange: detail.ok ? detail.keyExchange : undefined,
      report: buildTlsReport({
        protocols,
        ciphers,
        ocspStapling,
        certificateTransparency,
        incomplete,
      }),
    };
  }
}

const isLegacy = (v: TlsProtocolVersion) => v === 'TLSv1' || v === 'TLSv1.1';

function dedupe(ciphers: TlsCipherResult[]): TlsCipherResult[] {
  const seen = new Set<string>();
  return ciphers.filter((c) => {
    const key = `${c.protocol}|${c.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
