import { generateKeyPairSync } from 'node:crypto';
import {
  dmarcCandidates,
  parseDkim,
  parseDmarc,
  parseTags,
} from './email-records.js';

describe('email records', () => {
  it('parses tag lists', () => {
    expect(parseTags('v=DMARC1; p=reject ;rua=mailto:a@x.test;')).toEqual({
      v: 'DMARC1',
      p: 'reject',
      rua: 'mailto:a@x.test',
    });
  });

  it('parses DMARC', () => {
    const d = parseDmarc(
      '_dmarc.x.test',
      'v=DMARC1; p=Quarantine; sp=none; pct=50; rua=mailto:a@x.test,mailto:b@y.test',
    );
    expect(d).toMatchObject({
      policy: 'quarantine',
      subdomainPolicy: 'none',
      pct: 50,
      rua: ['mailto:a@x.test', 'mailto:b@y.test'],
      ruf: [],
    });
  });

  it('reads the RSA key size of a DKIM record', () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const p = publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64');
    expect(parseDkim('s1', `v=DKIM1; k=rsa; p=${p}`)).toEqual({
      selector: 's1',
      found: true,
      keyType: 'rsa',
      keyBits: 1024,
    });
  });

  it('marks empty p= as revoked', () => {
    expect(parseDkim('old', 'v=DKIM1; p=').revoked).toBe(true);
  });

  it('walks up to the parent domains for DMARC', () => {
    expect(dmarcCandidates('a.b.x.test')).toEqual([
      'a.b.x.test',
      'b.x.test',
      'x.test',
    ]);
  });
});
