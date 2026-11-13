import {
  gradeFindings,
  type Finding,
  type GradedReport,
  type TlsCipherResult,
  type TlsProtocolResult,
  type TlsProtocolVersion,
} from '@recon/shared';

/** DER encoding of OID 1.3.6.1.4.1.11129.2.4.2 (embedded SCT list). */
const SCT_LIST_OID = Buffer.from([
  0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0xd6, 0x79, 0x02, 0x04, 0x02,
]);

/** True when the certificate DER carries the embedded SCT list extension. */
export function hasEmbeddedScts(der: Buffer): boolean {
  return der.includes(SCT_LIST_OID);
}

export interface EphemeralKeyInfo {
  type?: string;
  name?: string;
  size?: number;
}

/** "X25519", "ECDH prime256v1 256 bits", "DH 2048 bits". */
export function formatKeyExchange(
  info: EphemeralKeyInfo | null | undefined,
): string | undefined {
  if (!info || (!info.type && !info.name)) return undefined;
  if (info.type === 'TLSGroup' || (info.name && info.type === info.name)) {
    return info.name;
  }
  return [info.type, info.name, info.size ? `${info.size} bits` : undefined]
    .filter(Boolean)
    .join(' ');
}

export interface TlsReportInput {
  protocols: TlsProtocolResult[];
  ciphers: TlsCipherResult[];
  ocspStapling: boolean | null;
  certificateTransparency: boolean | null;
  /** Cipher enumeration stopped early (time budget). */
  incomplete?: boolean;
}

const LABEL: Record<TlsProtocolVersion, string> = {
  TLSv1: 'TLS 1.0',
  'TLSv1.1': 'TLS 1.1',
  'TLSv1.2': 'TLS 1.2',
  'TLSv1.3': 'TLS 1.3',
};

function protocolFinding(
  p: TlsProtocolResult | undefined,
  version: TlsProtocolVersion,
): Finding {
  const id = `tls.protocol.${LABEL[version].slice(4).replace('.', '_')}`;
  const title = LABEL[version];
  const legacy = version === 'TLSv1' || version === 'TLSv1.1';
  if (!p || (!p.supported && p.error)) {
    return {
      id,
      status: 'info',
      title,
      message: `Could not test ${title}${p?.error ? `: ${p.error}` : ''}.`,
    };
  }
  if (legacy) {
    return p.supported
      ? {
          id,
          status: 'fail',
          title,
          message: `${title} is enabled. It is deprecated (RFC 8996); disable it.`,
        }
      : { id, status: 'pass', title, message: `${title} is disabled.` };
  }
  return p.supported
    ? { id, status: 'pass', title, message: `${title} is supported.` }
    : {
        id,
        status: 'warn',
        title,
        message: `${title} is not supported; enable it for modern clients.`,
      };
}

const unique = (xs: string[]) => [...new Set(xs)];

export function buildTlsFindings(input: TlsReportInput): Finding[] {
  const findings: Finding[] = (
    ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'] as const
  ).map((v) =>
    protocolFinding(
      input.protocols.find((p) => p.version === v),
      v,
    ),
  );

  const insecure = unique(
    input.ciphers.filter((c) => c.strength === 'insecure').map((c) => c.name),
  );
  findings.push(
    insecure.length
      ? {
          id: 'tls.ciphers.insecure',
          status: 'fail',
          title: 'Insecure cipher suites',
          message: `${insecure.length} insecure suite(s) accepted (NULL/export/RC4/DES/anonymous/MD5).`,
          value: insecure.join(', '),
        }
      : {
          id: 'tls.ciphers.insecure',
          status: 'pass',
          title: 'Insecure cipher suites',
          message: 'No insecure cipher suites accepted.',
        },
  );

  const weak = unique(
    input.ciphers.filter((c) => c.strength === 'weak').map((c) => c.name),
  );
  findings.push(
    weak.length
      ? {
          id: 'tls.ciphers.weak',
          status: 'warn',
          title: 'Weak cipher suites',
          message: `${weak.length} weak suite(s) accepted (3DES, no forward secrecy or CBC on TLS 1.0/1.1).`,
          value: weak.join(', '),
        }
      : {
          id: 'tls.ciphers.weak',
          status: 'pass',
          title: 'Weak cipher suites',
          message: 'No weak cipher suites accepted.',
        },
  );

  findings.push(
    input.ocspStapling === null
      ? {
          id: 'tls.ocsp',
          status: 'info',
          title: 'OCSP stapling',
          message: 'Could not be checked.',
        }
      : input.ocspStapling
        ? {
            id: 'tls.ocsp',
            status: 'pass',
            title: 'OCSP stapling',
            message: 'The server staples an OCSP response.',
          }
        : {
            id: 'tls.ocsp',
            status: 'warn',
            title: 'OCSP stapling',
            message:
              'No OCSP response stapled; clients must contact the CA to check revocation.',
          },
  );

  findings.push(
    input.certificateTransparency === null
      ? {
          id: 'tls.ct',
          status: 'info',
          title: 'Certificate transparency',
          message: 'Could not be checked.',
        }
      : input.certificateTransparency
        ? {
            id: 'tls.ct',
            status: 'pass',
            title: 'Certificate transparency',
            message: 'The certificate carries embedded SCTs.',
          }
        : {
            id: 'tls.ct',
            status: 'warn',
            title: 'Certificate transparency',
            message:
              'No embedded SCTs in the certificate (they may still be delivered via TLS extension or OCSP).',
          },
  );

  if (input.incomplete) {
    findings.push({
      id: 'tls.ciphers.incomplete',
      status: 'info',
      title: 'Cipher enumeration incomplete',
      message:
        'The time budget was exhausted before every cipher suite was tested; the list may be incomplete.',
    });
  }
  return findings;
}

export function buildTlsReport(input: TlsReportInput): GradedReport {
  return gradeFindings(buildTlsFindings(input));
}
