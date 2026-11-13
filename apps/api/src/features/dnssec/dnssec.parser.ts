import type {
  DnskeyRecord,
  DnssecOutput,
  DnssecStatus,
  DsRecord,
  Finding,
  RrsigRecord,
} from '@recon/shared';

/** Cloudflare DNS-over-HTTPS JSON answer (application/dns-json). */
export interface DohRecord {
  name: string;
  type: number;
  TTL?: number;
  data: string;
}
export interface DohResponse {
  Status: number;
  TC?: boolean;
  RD?: boolean;
  RA?: boolean;
  Question?: { name: string; type: number }[];
  AD?: boolean;
  CD?: boolean;
  Answer?: DohRecord[];
  Authority?: DohRecord[];
  Comment?: string[] | string;
}

export const RR = {
  SOA: 6,
  DS: 43,
  RRSIG: 46,
  NSEC: 47,
  DNSKEY: 48,
  NSEC3: 50,
} as const;

export const DNS_STATUS = { NOERROR: 0, SERVFAIL: 2, NXDOMAIN: 3 } as const;

/** IANA "DNS Security Algorithm Numbers". */
const ALGORITHMS: Record<number, string> = {
  1: 'RSAMD5',
  2: 'DH',
  3: 'DSA',
  5: 'RSASHA1',
  6: 'DSA-NSEC3-SHA1',
  7: 'RSASHA1-NSEC3-SHA1',
  8: 'RSASHA256',
  10: 'RSASHA512',
  12: 'ECC-GOST',
  13: 'ECDSAP256SHA256',
  14: 'ECDSAP384SHA384',
  15: 'ED25519',
  16: 'ED448',
  17: 'SM2SM3',
  23: 'ECC-GOST12',
  252: 'INDIRECT',
  253: 'PRIVATEDNS',
  254: 'PRIVATEOID',
};

/** RFC 8624: MUST NOT sign with these. */
const FORBIDDEN_ALGORITHMS = new Set([1, 3, 6, 12]);
/** RFC 8624: NOT RECOMMENDED (SHA-1 based). */
const WEAK_ALGORITHMS = new Set([5, 7]);
const RSA_ALGORITHMS = new Set([1, 5, 7, 8, 10]);

const DIGEST_TYPES: Record<number, string> = {
  1: 'SHA-1',
  2: 'SHA-256',
  3: 'GOST R 34.11-94',
  4: 'SHA-384',
};

const RR_TYPE_NAMES: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  43: 'DS',
  46: 'RRSIG',
  47: 'NSEC',
  48: 'DNSKEY',
  50: 'NSEC3',
};

export function algorithmName(alg: number): string {
  return ALGORITHMS[alg] ?? `ALG${alg}`;
}

export function digestName(type: number): string {
  return DIGEST_TYPES[type] ?? `type ${type}`;
}

const DAY_MS = 86_400_000;

function ofType(records: DohRecord[] | undefined, type: number) {
  return (records ?? []).filter((r) => r.type === type);
}

/** DS: "keytag algorithm digesttype digest". */
export function parseDs(data: string): DsRecord | undefined {
  const m = /^(\d+)\s+(\d+)\s+(\d+)\s+([0-9a-fA-F\s]+)$/.exec(data.trim());
  if (!m) return undefined;
  const algorithm = Number(m[2]);
  return {
    keyTag: Number(m[1]),
    algorithm,
    algorithmName: algorithmName(algorithm),
    digestType: Number(m[3]),
    digest: m[4]!.replace(/\s+/g, '').toLowerCase(),
  };
}

/** DNSKEY: "flags protocol algorithm base64key". */
export function parseDnskey(data: string): DnskeyRecord | undefined {
  const m = /^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(data.trim());
  if (!m) return undefined;
  const flags = Number(m[1]);
  const algorithm = Number(m[3]);
  const zoneKey = (flags & 0x0100) !== 0;
  const revoked = (flags & 0x0080) !== 0;
  const role: DnskeyRecord['role'] =
    zoneKey && !revoked ? (flags & 0x0001 ? 'KSK' : 'ZSK') : 'other';
  const key: DnskeyRecord = {
    flags,
    role,
    algorithm,
    algorithmName: algorithmName(algorithm),
  };
  if (RSA_ALGORITHMS.has(algorithm)) {
    const bits = rsaKeyBits(m[4]!.replace(/\s+/g, ''));
    if (bits) key.keyBits = bits;
  }
  return key;
}

/** Modulus size of an RFC 3110 RSA public key (exponent length, exponent, modulus). */
export function rsaKeyBits(base64: string): number | undefined {
  const raw = Buffer.from(base64, 'base64');
  if (raw.length < 3) return undefined;
  let expLen = raw[0]!;
  let offset = 1;
  if (expLen === 0) {
    expLen = raw.readUInt16BE(1);
    offset = 3;
  }
  let modStart = offset + expLen;
  // Leading zero bytes do not count towards the key size.
  while (modStart < raw.length && raw[modStart] === 0) modStart++;
  if (modStart >= raw.length) return undefined;
  const leadingZeros = Math.clz32(raw[modStart]!) - 24;
  return (raw.length - modStart) * 8 - leadingZeros;
}

/** RRSIG time: YYYYMMDDHHmmss (UTC) or seconds since the epoch. */
export function parseSigTime(value: string): Date | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (m) {
    const [, y, mo, d, h, mi, s] = m.map(Number) as number[];
    return new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!, s!));
  }
  if (/^\d{1,11}$/.test(value)) return new Date(Number(value) * 1000);
  return undefined;
}

export interface ParsedRrsig extends RrsigRecord {
  /** Total validity window in days (inception to expiration). */
  lifetimeDays: number;
}

/** RRSIG: "type alg labels origttl expiration inception keytag signer signature". */
export function parseRrsig(data: string, now: Date): ParsedRrsig | undefined {
  const p = data.trim().split(/\s+/);
  if (p.length < 8) return undefined;
  const expiration = parseSigTime(p[4]!);
  const inception = parseSigTime(p[5]!);
  if (!expiration || !inception || !/^\d+$/.test(p[1]!)) return undefined;
  const typeCovered = /^\d+$/.test(p[0]!)
    ? (RR_TYPE_NAMES[Number(p[0])] ?? `TYPE${p[0]}`)
    : p[0]!.toUpperCase();
  return {
    typeCovered,
    algorithm: Number(p[1]),
    signer: p[7]!,
    inception: inception.toISOString(),
    expiration: expiration.toISOString(),
    daysRemaining:
      Math.round(((expiration.getTime() - now.getTime()) / DAY_MS) * 10) / 10,
    lifetimeDays:
      Math.round(((expiration.getTime() - inception.getTime()) / DAY_MS) * 10) /
      10,
  };
}

export interface DnssecResponses {
  ds: DohResponse;
  dnskey: DohResponse;
  /** SOA with validation (cd=0). */
  soa: DohResponse;
  /** SOA with checking disabled (cd=1), only queried on SERVFAIL. */
  soaUnchecked?: DohResponse;
  /** Query for a random nonexistent name, for NSEC/NSEC3 detection. */
  nonexistent: DohResponse;
}

export function determineStatus(
  r: DnssecResponses,
  hasDs: boolean,
): DnssecStatus {
  if (r.soa.Status === DNS_STATUS.NOERROR && r.soa.AD) return 'secure';
  if (
    r.soa.Status === DNS_STATUS.SERVFAIL &&
    r.soaUnchecked?.Status === DNS_STATUS.NOERROR
  ) {
    return 'bogus';
  }
  if (!hasDs) return 'insecure';
  return 'indeterminate';
}

/** NSEC/NSEC3 records in the authority section that belong to the domain's zone. */
export function detectDenial(
  domain: string,
  res: DohResponse,
): 'NSEC' | 'NSEC3' | undefined {
  const d = domain.toLowerCase().replace(/\.$/, '');
  const inZone = (name: string) => {
    const n = name.toLowerCase().replace(/\.$/, '');
    return n === d || n.endsWith(`.${d}`);
  };
  const auth = res.Authority ?? [];
  if (auth.some((r) => r.type === RR.NSEC3 && inZone(r.name))) return 'NSEC3';
  if (auth.some((r) => r.type === RR.NSEC && inZone(r.name))) return 'NSEC';
  return undefined;
}

/** Collects and parses everything; pure (time is passed in). */
export function analyzeDnssec(
  domain: string,
  resolver: string,
  r: DnssecResponses,
  now: Date,
): DnssecOutput {
  const ds = ofType(r.ds.Answer, RR.DS)
    .map((x) => parseDs(x.data))
    .filter((x): x is DsRecord => !!x);
  const dnskeys = ofType(r.dnskey.Answer, RR.DNSKEY)
    .map((x) => parseDnskey(x.data))
    .filter((x): x is DnskeyRecord => !!x);
  const sigs = [r.ds, r.dnskey, r.soaUnchecked ?? r.soa]
    .flatMap((res) => ofType(res.Answer, RR.RRSIG))
    .map((x) => parseRrsig(x.data, now))
    .filter((x): x is ParsedRrsig => !!x);

  const status = determineStatus(r, ds.length > 0);
  const denial = detectDenial(domain, r.nonexistent);
  const findings = buildDnssecFindings({
    domain,
    status,
    ds,
    dnskeys,
    signatures: sigs,
  });
  const signatures: RrsigRecord[] = sigs.map(
    ({ lifetimeDays: _lifetime, ...s }) => s,
  );
  return {
    domain,
    resolver,
    status,
    ds,
    dnskeys,
    signatures,
    ...(denial ? { denial } : {}),
    findings,
  };
}

const SHORT_LIVED_DAYS = 7;

export function buildDnssecFindings(d: {
  domain: string;
  status: DnssecStatus;
  ds: DsRecord[];
  dnskeys: DnskeyRecord[];
  signatures: ParsedRrsig[];
}): Finding[] {
  const f: Finding[] = [];

  switch (d.status) {
    case 'secure':
      f.push({
        id: 'dnssec.status',
        status: 'pass',
        title: 'DNSSEC validates',
        message: `A validating resolver authenticates the chain of trust for ${d.domain}.`,
      });
      break;
    case 'insecure':
      f.push({
        id: 'dnssec.status',
        status: 'warn',
        title: 'Domain is not signed',
        message: d.dnskeys.length
          ? 'DNSKEY records are published, but the parent zone has no DS record, so the chain of trust is not anchored. Add the DS record at your registrar.'
          : 'No DS record at the parent zone. DNS answers for this domain can be spoofed without detection; enable DNSSEC at your DNS provider and registrar.',
      });
      break;
    case 'bogus':
      f.push({
        id: 'dnssec.status',
        status: 'fail',
        title: 'DNSSEC validation fails',
        message:
          'Validating resolvers reject the answers (SERVFAIL), so the domain is unreachable for users behind them. Check that the DS record at the parent matches a current DNSKEY and that signatures are not expired.',
      });
      break;
    default:
      f.push({
        id: 'dnssec.status',
        status: 'info',
        title: 'DNSSEC status unclear',
        message:
          'A DS record exists, but the resolver did not mark the answer as authenticated.',
      });
  }

  const algs = new Set([
    ...d.ds.map((x) => x.algorithm),
    ...d.dnskeys.filter((k) => k.role !== 'other').map((k) => k.algorithm),
  ]);
  for (const alg of [...algs].sort((a, b) => a - b)) {
    if (FORBIDDEN_ALGORITHMS.has(alg)) {
      f.push({
        id: `dnssec.alg.${alg}`,
        status: 'fail',
        title: 'Deprecated signing algorithm',
        message: `${algorithmName(alg)} (${alg}) must not be used for DNSSEC signing (RFC 8624). Roll over to ECDSAP256SHA256 (13) or ED25519 (15).`,
        value: algorithmName(alg),
      });
    } else if (WEAK_ALGORITHMS.has(alg)) {
      f.push({
        id: `dnssec.alg.${alg}`,
        status: 'warn',
        title: 'SHA-1 based signing algorithm',
        message: `${algorithmName(alg)} (${alg}) is not recommended any more (RFC 8624) and some validators reject SHA-1. Roll over to ECDSAP256SHA256 (13).`,
        value: algorithmName(alg),
      });
    }
  }

  const sha1Ds = d.ds.filter((x) => x.digestType === 1);
  if (sha1Ds.length) {
    f.push({
      id: 'dnssec.ds.sha1',
      status: 'warn',
      title: 'DS record with SHA-1 digest',
      message:
        'The parent publishes a DS record with a SHA-1 digest (type 1). Use SHA-256 (type 2) and remove the SHA-1 DS.',
      value: sha1Ds.map((x) => `key tag ${x.keyTag}`).join(', '),
    });
  }

  const shortKsk = d.dnskeys.filter(
    (k) => k.role === 'KSK' && k.keyBits !== undefined && k.keyBits < 2048,
  );
  if (shortKsk.length) {
    f.push({
      id: 'dnssec.ksk.size',
      status: 'warn',
      title: 'Short RSA key-signing key',
      message:
        'RSA key-signing keys should have at least 2048 bits. Roll over to a longer key or to an ECDSA algorithm.',
      value: shortKsk.map((k) => `${k.keyBits} bits`).join(', '),
    });
  }

  const expired = d.signatures.filter((s) => s.daysRemaining < 0);
  // Online signers (e.g. Cloudflare) issue signatures valid for only a few days and
  // refresh them continuously; a short remaining time is only a problem for long-lived ones.
  const expiring = d.signatures.filter(
    (s) =>
      s.daysRemaining >= 0 &&
      s.daysRemaining < 7 &&
      s.lifetimeDays > SHORT_LIVED_DAYS,
  );
  const describe = (list: ParsedRrsig[]) =>
    list.map((s) => `${s.typeCovered} (${s.expiration})`).join(', ');
  if (expired.length) {
    f.push({
      id: 'dnssec.rrsig.expired',
      status: 'fail',
      title: 'Expired signatures',
      message:
        'Some RRSIG records have expired; validating resolvers will reject these answers. Re-sign the zone and check the signer.',
      value: describe(expired),
    });
  }
  if (expiring.length) {
    f.push({
      id: 'dnssec.rrsig.expiring',
      status: 'warn',
      title: 'Signatures expire soon',
      message:
        'Some RRSIG records expire within 7 days. Make sure automatic re-signing is running.',
      value: describe(expiring),
    });
  }
  if (d.signatures.length && !expired.length && !expiring.length) {
    f.push({
      id: 'dnssec.rrsig.valid',
      status: 'pass',
      title: 'Signatures current',
      message: `All ${d.signatures.length} observed signatures are within their validity period.`,
    });
  }
  return f;
}
