import type { CertificateInfo } from '@recon/shared';
import type { DetailedPeerCertificate } from 'node:tls';

const DAY_MS = 86_400_000;

function formatDn(dn: Record<string, string | string[]> | undefined): string {
  if (!dn) return '';
  return Object.entries(dn)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('+') : v}`)
    .join(', ');
}

export function parseSubjectAltNames(san: string | undefined): string[] {
  if (!san) return [];
  return san
    .split(/,\s*/)
    .map((entry) => entry.replace(/^(DNS|IP Address|email|URI):/i, '').trim())
    .filter(Boolean);
}

export function toCertificateInfo(
  cert: DetailedPeerCertificate,
  now = Date.now(),
): CertificateInfo {
  const validTo = new Date(cert.valid_to);
  return {
    subject: formatDn(cert.subject as unknown as Record<string, string>),
    issuer: formatDn(cert.issuer as unknown as Record<string, string>),
    validFrom: new Date(cert.valid_from).toISOString(),
    validTo: validTo.toISOString(),
    daysRemaining: Math.floor((validTo.getTime() - now) / DAY_MS),
    serialNumber: cert.serialNumber,
    fingerprint256: cert.fingerprint256,
    subjectAltNames: parseSubjectAltNames(cert.subjectaltname),
    keyBits: cert.bits,
    selfSigned: cert.fingerprint256 === cert.issuerCertificate?.fingerprint256,
  };
}

/** Walks the issuer chain, leaf first, stopping at the self-signed root. */
export function walkChain(
  leaf: DetailedPeerCertificate,
): DetailedPeerCertificate[] {
  const chain: DetailedPeerCertificate[] = [];
  const seen = new Set<string>();
  let current: DetailedPeerCertificate | undefined = leaf;
  while (current?.fingerprint256 && !seen.has(current.fingerprint256)) {
    chain.push(current);
    seen.add(current.fingerprint256);
    current = current.issuerCertificate;
  }
  return chain;
}
