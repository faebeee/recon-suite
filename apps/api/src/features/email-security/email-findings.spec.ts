import { gradeFindings, type EmailSecurityOutput } from '@recon/shared';
import { buildEmailFindings } from './email-findings.js';

type Data = Omit<EmailSecurityOutput, 'report'>;

const strong: Data = {
  domain: 'x.test',
  mx: ['10 mx.x.test'],
  spf: {
    record: 'v=spf1 include:_spf.x.test -all',
    recordCount: 1,
    all: '-all',
    lookups: 2,
    includes: ['_spf.x.test'],
    errors: [],
  },
  dmarc: {
    name: '_dmarc.x.test',
    record: 'v=DMARC1; p=reject; rua=mailto:d@x.test',
    policy: 'reject',
    rua: ['mailto:d@x.test'],
    ruf: [],
  },
  dkim: {
    checked: 16,
    found: [{ selector: 's1', found: true, keyType: 'rsa', keyBits: 2048 }],
  },
  mtaSts: { record: 'v=STSv1; id=1', id: '1' },
  tlsRpt: {
    record: 'v=TLSRPTv1; rua=mailto:t@x.test',
    rua: ['mailto:t@x.test'],
  },
};

const status = (d: Data, id: string) =>
  buildEmailFindings(d).find((f) => f.id === id)?.status;

describe('buildEmailFindings', () => {
  it('grades a complete setup A+', () => {
    expect(gradeFindings(buildEmailFindings(strong)).grade).toBe('A+');
  });

  it('fails missing SPF and DMARC', () => {
    const d: Data = {
      ...strong,
      spf: { recordCount: 0, lookups: 0, includes: [], errors: [] },
      dmarc: { rua: [], ruf: [] },
    };
    expect(status(d, 'spf.present')).toBe('fail');
    expect(status(d, 'dmarc.present')).toBe('fail');
    expect(gradeFindings(buildEmailFindings(d)).score).toBeLessThan(70);
  });

  it('fails more than 10 SPF lookups and +all', () => {
    const d: Data = {
      ...strong,
      spf: { ...strong.spf, lookups: 12, all: '+all' },
    };
    expect(status(d, 'spf.lookups')).toBe('fail');
    expect(status(d, 'spf.all')).toBe('fail');
  });

  it('accepts ~all only with an enforcing DMARC policy', () => {
    const soft: Data = { ...strong, spf: { ...strong.spf, all: '~all' } };
    expect(status(soft, 'spf.all')).toBe('pass');
    expect(
      status(
        { ...soft, dmarc: { ...strong.dmarc, policy: 'none' } },
        'spf.all',
      ),
    ).toBe('warn');
  });

  it('flags weak DKIM keys', () => {
    const d: Data = {
      ...strong,
      dkim: {
        checked: 16,
        found: [{ selector: 'old', found: true, keyType: 'rsa', keyBits: 512 }],
      },
    };
    expect(status(d, 'dkim.bits.old')).toBe('fail');
  });

  it('skips transport checks when the domain has no MX', () => {
    const d: Data = { ...strong, mx: [], mtaSts: undefined, tlsRpt: undefined };
    expect(status(d, 'mx.none')).toBe('info');
    expect(status(d, 'mta-sts')).toBeUndefined();
  });
});
