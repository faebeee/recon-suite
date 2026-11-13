import { classifyCipher, isTls12Only } from './tls-audit.classify.js';

describe('classifyCipher', () => {
  it.each([
    ['NULL-SHA', 'TLSv1.2', 'insecure', 'NULL encryption'],
    ['EXP-RC4-MD5', 'TLSv1', 'insecure', 'export grade'],
    ['RC4-SHA', 'TLSv1.2', 'insecure', 'RC4'],
    ['DES-CBC-SHA', 'TLSv1.2', 'insecure', 'single DES'],
    ['ADH-AES128-SHA', 'TLSv1.2', 'insecure', 'anonymous (no authentication)'],
    [
      'AECDH-AES128-SHA',
      'TLSv1.2',
      'insecure',
      'anonymous (no authentication)',
    ],
    ['RC4-MD5', 'TLSv1.2', 'insecure', 'MD5'],
    ['DES-CBC3-SHA', 'TLSv1.2', 'weak', '3DES'],
    ['ECDHE-RSA-DES-CBC3-SHA', 'TLSv1.2', 'weak', '3DES'],
    ['AES128-GCM-SHA256', 'TLSv1.2', 'weak', 'no forward secrecy'],
    ['ECDHE-RSA-AES128-SHA', 'TLSv1', 'weak', 'CBC mode'],
    ['ECDHE-RSA-AES256-SHA', 'TLSv1.1', 'weak', 'CBC mode'],
    ['ECDHE-RSA-AES128-SHA256', 'TLSv1.2', 'acceptable', 'CBC mode'],
    ['DHE-RSA-AES256-SHA', 'TLSv1.2', 'acceptable', 'CBC mode'],
    ['ECDHE-ARIA128-GCM-SHA256', 'TLSv1.2', 'acceptable', 'ARIA'],
    ['DHE-RSA-CAMELLIA128-SHA', 'TLSv1.2', 'acceptable', 'CAMELLIA'],
  ] as const)('%s on %s is %s (%s)', (name, protocol, strength, note) => {
    const r = classifyCipher(name, protocol);
    expect(r.strength).toBe(strength);
    expect(r.notes).toContain(note);
  });

  it.each([
    ['ECDHE-RSA-AES128-GCM-SHA256', 'TLSv1.2'],
    ['ECDHE-ECDSA-CHACHA20-POLY1305', 'TLSv1.2'],
    ['DHE-RSA-AES256-GCM-SHA384', 'TLSv1.2'],
    ['ECDHE-ECDSA-AES128-CCM', 'TLSv1.2'],
    ['TLS_AES_128_GCM_SHA256', 'TLSv1.3'],
    ['TLS_CHACHA20_POLY1305_SHA256', 'TLSv1.3'],
  ] as const)('%s on %s is strong', (name, protocol) => {
    expect(classifyCipher(name, protocol)).toEqual({
      strength: 'strong',
      notes: [],
    });
  });

  it('keeps the worst rating and collects every note', () => {
    const r = classifyCipher('DES-CBC3-SHA', 'TLSv1');
    expect(r.strength).toBe('weak');
    expect(r.notes).toEqual(['3DES', 'no forward secrecy', 'CBC mode']);
    expect(classifyCipher('RC4-MD5', 'TLSv1').strength).toBe('insecure');
  });

  it('does not treat 3DES as single DES', () => {
    expect(classifyCipher('DES-CBC3-SHA', 'TLSv1.2').notes).not.toContain(
      'single DES',
    );
  });
});

describe('isTls12Only', () => {
  it('detects suites that need TLS 1.2', () => {
    expect(isTls12Only('ECDHE-RSA-AES128-GCM-SHA256')).toBe(true);
    expect(isTls12Only('AES256-SHA256')).toBe(true);
    expect(isTls12Only('ECDHE-RSA-AES128-SHA')).toBe(false);
  });
});
