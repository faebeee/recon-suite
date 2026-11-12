import { domainCandidates, parseRdap } from './rdap.parser.js';

describe('rdap parser', () => {
  it('extracts registrar, events and nameservers', () => {
    const out = parseRdap(
      {
        ldhName: 'EXAMPLE.COM',
        status: ['client transfer prohibited'],
        events: [
          { eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' },
        ],
        nameservers: [{ ldhName: 'A.IANA-SERVERS.NET' }],
        entities: [
          {
            roles: ['registrar'],
            handle: '376',
            vcardArray: ['vcard', [['fn', {}, 'text', 'RESERVED-IANA']]],
          },
        ],
      },
      'domain',
      'example.com',
      'https://rdap.org/domain/example.com',
    );
    expect(out.registrar).toBe('RESERVED-IANA');
    expect(out.nameservers).toEqual(['a.iana-servers.net']);
    expect(out.events[0]).toEqual({
      action: 'registration',
      date: '1995-08-14T04:00:00Z',
    });
  });

  it('builds parent domain candidates', () => {
    expect(domainCandidates('a.b.example.com')).toEqual([
      'a.b.example.com',
      'b.example.com',
      'example.com',
    ]);
  });
});
