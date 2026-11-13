import type { Finding, TlsOutput } from '@recon/shared';

export function tlsFindings(d: TlsOutput): Finding[] {
  const f: Finding[] = [];
  const cert = d.certificate;
  f.push(
    d.authorized
      ? {
          id: 'tls.trust',
          status: 'pass',
          title: 'Certificate trust',
          message: 'Chain validates against public roots.',
        }
      : {
          id: 'tls.trust',
          status: 'fail',
          title: 'Certificate trust',
          message: `Certificate does not validate${cert.selfSigned ? ' (self-signed)' : ''}.`,
          value: d.authorizationError,
        },
  );
  f.push(
    cert.daysRemaining < 0
      ? {
          id: 'tls.expiry',
          status: 'fail',
          title: 'Certificate expiry',
          message: 'Certificate has expired.',
          value: cert.validTo,
        }
      : cert.daysRemaining < 14
        ? {
            id: 'tls.expiry',
            status: 'warn',
            title: 'Certificate expiry',
            message: `Certificate expires in ${cert.daysRemaining} days.`,
            value: cert.validTo,
          }
        : {
            id: 'tls.expiry',
            status: 'pass',
            title: 'Certificate expiry',
            message: `Valid for ${cert.daysRemaining} more days.`,
            value: cert.validTo,
          },
  );
  if (d.protocol === 'TLSv1' || d.protocol === 'TLSv1.1') {
    f.push({
      id: 'tls.protocol',
      status: 'fail',
      title: 'Protocol',
      message: `Server negotiated the deprecated ${d.protocol}.`,
    });
  }
  if (
    cert.keyBits !== undefined &&
    cert.keyBits < 2048 &&
    !/EC/i.test(cert.subject)
  ) {
    f.push({
      id: 'tls.keysize',
      status: 'warn',
      title: 'Key size',
      message: `${cert.keyBits}-bit key; 2048 bits or an EC key is recommended.`,
    });
  }
  return f;
}
