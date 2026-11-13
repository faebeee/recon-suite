import { createPublicKey } from 'node:crypto';
import type { DkimSelectorResult, DmarcReport } from '@recon/shared';

/** Parses "k1=v1; k2=v2" tag lists used by DMARC, DKIM, MTA-STS, TLS-RPT and BIMI. */
export function parseTags(record: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of record.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    tags[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return tags;
}

const splitUris = (value: string | undefined) =>
  value
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

export function parseDmarc(name: string, record: string): DmarcReport {
  const tags = parseTags(record);
  const pct = tags.pct !== undefined ? Number(tags.pct) : undefined;
  return {
    name,
    record,
    policy: tags.p?.toLowerCase(),
    subdomainPolicy: tags.sp?.toLowerCase(),
    pct: pct !== undefined && Number.isFinite(pct) ? pct : undefined,
    rua: splitUris(tags.rua),
    ruf: splitUris(tags.ruf),
  };
}

export function parseDkim(
  selector: string,
  record: string,
): DkimSelectorResult {
  const tags = parseTags(record);
  const keyType = (tags.k || 'rsa').toLowerCase();
  const p = (tags.p ?? '').replace(/\s+/g, '');
  if (!p) return { selector, found: true, keyType, revoked: true };
  return { selector, found: true, keyType, keyBits: keyBits(keyType, p) };
}

function keyBits(keyType: string, base64: string): number | undefined {
  if (keyType === 'ed25519') return 256;
  try {
    const key = createPublicKey({
      key: Buffer.from(base64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return key.asymmetricKeyDetails?.modulusLength;
  } catch {
    return undefined;
  }
}

export const tagRecord = (prefix: RegExp) => (txts: string[]) =>
  txts.find((t) => prefix.test(t.trim()));

/** example.com, then parents down to two labels: a.b.example.com -> b.example.com -> example.com */
export function dmarcCandidates(domain: string): string[] {
  const labels = domain.split('.');
  const out: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) {
    out.push(labels.slice(i).join('.'));
  }
  return out;
}
