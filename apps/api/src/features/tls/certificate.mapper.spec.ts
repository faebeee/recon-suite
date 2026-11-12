import { parseSubjectAltNames } from './certificate.mapper.js';

describe('parseSubjectAltNames', () => {
  it('strips SAN type prefixes', () => {
    expect(
      parseSubjectAltNames(
        'DNS:example.com, DNS:*.example.com, IP Address:1.2.3.4',
      ),
    ).toEqual(['example.com', '*.example.com', '1.2.3.4']);
  });
});
