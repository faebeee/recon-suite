import type { Finding, HttpHeadersOutput } from '@recon/shared';

/** Security-header checks as graded findings, plus version disclosures as info. */
export function httpHeadersFindings(d: HttpHeadersOutput): Finding[] {
  return [
    ...d.security.checks.map((c): Finding => ({
      id: `headers.${c.header}`,
      status: c.status,
      title: c.header,
      message: c.message,
      value: c.value,
    })),
    ...d.security.disclosures.map((h): Finding => ({
      id: `headers.disclosure.${h.header}`,
      status: 'info',
      title: `${h.header} disclosure`,
      message: 'Response header reveals implementation details.',
      value: h.value,
    })),
  ];
}
