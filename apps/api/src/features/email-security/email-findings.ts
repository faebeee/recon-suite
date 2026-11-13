import type { EmailSecurityOutput, Finding } from '@recon/shared';

type Data = Omit<EmailSecurityOutput, 'report'>;

/** Turns the collected records into graded findings. Pure, so it is unit-tested in isolation. */
export function buildEmailFindings(d: Data): Finding[] {
  const f: Finding[] = [];
  const receivesMail = d.mx.length > 0 && !d.mx.every((m) => /\s\.?$/.test(m));
  const enforcing =
    d.dmarc.policy === 'reject' || d.dmarc.policy === 'quarantine';

  if (!receivesMail) {
    f.push({
      id: 'mx.none',
      status: 'info',
      title: 'No inbound mail',
      message:
        'No usable MX record. If the domain never sends mail, publish "v=spf1 -all" and a DMARC p=reject record to stop spoofing.',
    });
  }

  // SPF
  if (d.spf.recordCount === 0) {
    f.push({
      id: 'spf.present',
      status: 'fail',
      title: 'SPF',
      message: 'No SPF record. Anyone can claim to send mail for this domain.',
    });
  } else if (d.spf.recordCount > 1) {
    f.push({
      id: 'spf.present',
      status: 'fail',
      title: 'SPF',
      message: `${d.spf.recordCount} SPF records found. Receivers treat this as a permanent error; merge them into one.`,
    });
  } else {
    f.push({
      id: 'spf.present',
      status: 'pass',
      title: 'SPF',
      message: 'Exactly one SPF record is published.',
      value: d.spf.record,
    });
    const all = d.spf.all;
    f.push(
      all === '-all'
        ? {
            id: 'spf.all',
            status: 'pass',
            title: 'SPF policy',
            message: 'Hard fail (-all) for unlisted senders.',
            value: all,
          }
        : all === '~all'
          ? {
              id: 'spf.all',
              status: enforcing ? 'pass' : 'warn',
              title: 'SPF policy',
              message: enforcing
                ? 'Soft fail (~all); DMARC enforcement does the rejecting.'
                : 'Soft fail (~all) without an enforcing DMARC policy lets spoofed mail through.',
              value: all,
            }
          : all === '+all'
            ? {
                id: 'spf.all',
                status: 'fail',
                title: 'SPF policy',
                message: '+all authorises every server on the internet.',
                value: all,
              }
            : {
                id: 'spf.all',
                status: 'warn',
                title: 'SPF policy',
                message: all
                  ? 'Neutral (?all) gives receivers no guidance for unlisted senders.'
                  : 'No "all" mechanism: unlisted senders get a neutral result.',
                value: all,
              },
    );
    f.push({
      id: 'spf.lookups',
      status:
        d.spf.lookups > 10 ? 'fail' : d.spf.lookups >= 9 ? 'warn' : 'pass',
      title: 'SPF DNS lookups',
      message:
        d.spf.lookups > 10
          ? 'More than 10 DNS lookups: receivers return permerror and SPF fails for every message.'
          : d.spf.lookups >= 9
            ? 'Close to the limit of 10 DNS lookups; one more include breaks SPF.'
            : 'Within the limit of 10 DNS lookups.',
      value: `${d.spf.lookups}/10`,
    });
    if (d.spf.errors.length) {
      f.push({
        id: 'spf.errors',
        status: 'warn',
        title: 'SPF includes',
        message: d.spf.errors.join('; '),
      });
    }
  }

  // DMARC
  if (!d.dmarc.record) {
    f.push({
      id: 'dmarc.present',
      status: 'fail',
      title: 'DMARC',
      message:
        'No DMARC record. Receivers get no policy for mail that fails SPF/DKIM and you get no reports.',
    });
  } else {
    const inherited = d.dmarc.name !== `_dmarc.${d.domain}`;
    f.push({
      id: 'dmarc.policy',
      status: enforcing ? 'pass' : 'warn',
      title: 'DMARC policy',
      message: enforcing
        ? `Policy ${d.dmarc.policy}: failing mail is ${d.dmarc.policy === 'reject' ? 'rejected' : 'sent to spam'}.`
        : 'Policy "none" only monitors; spoofed mail is still delivered.',
      value: d.dmarc.record,
    });
    if (inherited) {
      f.push({
        id: 'dmarc.inherited',
        status: 'info',
        title: 'DMARC source',
        message: `Inherited from ${d.dmarc.name}${d.dmarc.subdomainPolicy ? ` (sp=${d.dmarc.subdomainPolicy} applies)` : ''}.`,
      });
    }
    if (d.dmarc.pct !== undefined && d.dmarc.pct < 100) {
      f.push({
        id: 'dmarc.pct',
        status: 'warn',
        title: 'DMARC coverage',
        message: `pct=${d.dmarc.pct}: the policy applies to only part of the failing mail.`,
      });
    }
    f.push({
      id: 'dmarc.rua',
      status: d.dmarc.rua.length ? 'pass' : 'warn',
      title: 'DMARC reports',
      message: d.dmarc.rua.length
        ? 'Aggregate reports (rua) are requested.'
        : 'No rua address: you will not see who sends mail as this domain.',
      value: d.dmarc.rua.join(', ') || undefined,
    });
  }

  // DKIM
  const active = d.dkim.found.filter((k) => !k.revoked);
  if (receivesMail || d.spf.recordCount > 0) {
    f.push({
      id: 'dkim.found',
      status: active.length ? 'pass' : 'warn',
      title: 'DKIM',
      message: active.length
        ? `Key found for selector${active.length > 1 ? 's' : ''} ${active.map((k) => k.selector).join(', ')}.`
        : `No key at the ${d.dkim.checked} selectors checked. The domain may use a custom selector; add it as an option.`,
    });
  }
  for (const k of active) {
    if (k.keyType === 'rsa' && k.keyBits !== undefined && k.keyBits < 2048) {
      f.push({
        id: `dkim.bits.${k.selector}`,
        status: k.keyBits < 1024 ? 'fail' : 'warn',
        title: `DKIM key ${k.selector}`,
        message:
          k.keyBits < 1024
            ? `${k.keyBits}-bit RSA key is breakable and ignored by major receivers.`
            : `${k.keyBits}-bit RSA key; 2048 bits is recommended.`,
      });
    }
  }

  // Transport security (only relevant when the domain receives mail)
  if (receivesMail) {
    f.push({
      id: 'mta-sts',
      status: d.mtaSts ? 'pass' : 'warn',
      title: 'MTA-STS',
      message: d.mtaSts
        ? 'MTA-STS is announced. The policy file itself is not fetched (passive tool).'
        : 'No MTA-STS: inbound SMTP TLS can be downgraded by an attacker in the path.',
      value: d.mtaSts?.record,
    });
    f.push({
      id: 'tls-rpt',
      status: d.tlsRpt ? 'pass' : 'warn',
      title: 'TLS-RPT',
      message: d.tlsRpt
        ? 'SMTP TLS failure reports are requested.'
        : 'No TLS-RPT record: TLS delivery failures go unreported.',
      value: d.tlsRpt?.record,
    });
  }
  if (d.bimi) {
    f.push({
      id: 'bimi',
      status: 'info',
      title: 'BIMI',
      message: 'Brand logo published for supporting mail clients.',
      value: d.bimi.logo ?? d.bimi.record,
    });
  }
  return f;
}
