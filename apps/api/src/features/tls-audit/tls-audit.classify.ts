import type { CipherStrength, TlsProtocolVersion } from '@recon/shared';

const RANK: Record<CipherStrength, number> = {
  strong: 0,
  acceptable: 1,
  weak: 2,
  insecure: 3,
};

export interface CipherClassification {
  strength: CipherStrength;
  notes: string[];
}

/**
 * Rates a cipher suite (OpenSSL name, e.g. "ECDHE-RSA-AES128-GCM-SHA256") as negotiated
 * on `protocol`. The worst matching rule wins; every matching rule adds a note.
 */
export function classifyCipher(
  name: string,
  protocol: TlsProtocolVersion,
): CipherClassification {
  const n = name.toUpperCase();
  if (protocol === 'TLSv1.3' || n.startsWith('TLS_')) {
    return { strength: 'strong', notes: [] };
  }

  let strength: CipherStrength = 'strong';
  const notes: string[] = [];
  const add = (s: CipherStrength, note: string) => {
    if (!notes.includes(note)) notes.push(note);
    if (RANK[s] > RANK[strength]) strength = s;
  };

  const anonymous = /(^|-)(ADH|AECDH)(-|$)|ANON|ANULL/.test(n);
  const forwardSecret = /^(ECDHE|DHE|EDH)-/.test(n);
  const aead = /GCM|CHACHA20|CCM/.test(n);

  if (/(^|-)NULL(-|$)|ENULL/.test(n)) add('insecure', 'NULL encryption');
  if (/(^|-)EXP/.test(n)) add('insecure', 'export grade');
  if (/RC4/.test(n)) add('insecure', 'RC4');
  if (/(^|-)DES-CBC-|(^|-)DES-CBC$|(^|-)DES-(SHA|MD5)/.test(n))
    add('insecure', 'single DES');
  if (anonymous) add('insecure', 'anonymous (no authentication)');
  if (n.endsWith('MD5')) add('insecure', 'MD5');

  if (/DES-CBC3|3DES/.test(n)) add('weak', '3DES');
  if (!forwardSecret && !anonymous) add('weak', 'no forward secrecy');
  if (!aead && (protocol === 'TLSv1' || protocol === 'TLSv1.1'))
    add('weak', 'CBC mode');

  if (!aead && protocol === 'TLSv1.2') add('acceptable', 'CBC mode');
  if (/CAMELLIA/.test(n)) add('acceptable', 'CAMELLIA');
  if (/ARIA/.test(n)) add('acceptable', 'ARIA');

  return { strength, notes };
}

/** True when a cipher suite (OpenSSL name) can only be negotiated on TLS 1.2. */
export function isTls12Only(name: string): boolean {
  return /GCM|CHACHA20|CCM|SHA256|SHA384/i.test(name);
}
