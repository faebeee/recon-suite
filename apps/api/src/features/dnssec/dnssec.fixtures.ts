/* Captured from https://cloudflare-dns.com/dns-query (application/dns-json) on 2026-11-13. */
import type { DohResponse } from './dnssec.parser.js';

export const FIXTURES = {
  cloudflare: {
    ds: {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: 'cloudflare.com',
          type: 43,
        },
      ],
      Answer: [
        {
          name: 'cloudflare.com',
          type: 43,
          TTL: 86400,
          data: '2371 13 2 32996839a6d808afe3eb4a795a0e6a7a39a76fc52ff228b22b76f6d63826f2b9',
        },
        {
          name: 'cloudflare.com',
          type: 46,
          TTL: 86400,
          data: 'DS 13 2 86400 1794877222 1794268222 65344 com. yLDMhshAHTZ7jYYq8HQugWvmiFEMIW/fn6hbwTU7HVUOT1GP1xHIwMTBzMwnVtDLWB+ry8w3SHvxq8MMyBalXQ==',
        },
      ],
    },
    dnskey: {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: 'cloudflare.com',
          type: 48,
        },
      ],
      Answer: [
        {
          name: 'cloudflare.com',
          type: 48,
          TTL: 1779,
          data: '256 3 13 oJMRESz5E4gYzS/q6XDrvU1qMPYIjCWzJaOau8XNEZeqCYKD5ar0IRd8KqXXFJkqmVfRvMGPmM1x8fGAa2XhSA==',
        },
        {
          name: 'cloudflare.com',
          type: 48,
          TTL: 1779,
          data: '257 3 13 mdsswUyr3DPW132mOi8V9xESWE8jTo0dxCjjnopKl+GqJxpVXckHAeF+KkxLbxILfDLUT0rAK9iUzy1L53eKGQ==',
        },
        {
          name: 'cloudflare.com',
          type: 46,
          TTL: 1779,
          data: 'DNSKEY 13 2 3600 1799211340 1793940940 2371 cloudflare.com. YLZri1lt/iM28cGKrBsG0Pzssde+2WVku4L+Sz7XSQxnC3eMFveZo8o9KBsbMNFyzzzqdDyTnIo9t7eUAKGleg==',
        },
      ],
    },
    soa: {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: 'cloudflare.com',
          type: 6,
        },
      ],
      Answer: [
        {
          name: 'cloudflare.com',
          type: 6,
          TTL: 300,
          data: 'ns3.cloudflare.com. dns.cloudflare.com. 2419984191 10000 2400 604800 300',
        },
        {
          name: 'cloudflare.com',
          type: 46,
          TTL: 300,
          data: 'SOA 13 2 300 1794645238 1794465238 34505 cloudflare.com. /Q45fTjYoQN1vdMJyXYaOLj2yU9eaK87DoMvoj9ZiM1Dc1uF0wwA5Q47KVX40asi/ZnWDsZ5u6U1UWuiNiEMqg==',
        },
      ],
    },
    nonexistent: {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_recon-x7.cloudflare.com',
          type: 1,
        },
      ],
      Authority: [
        {
          name: 'cloudflare.com',
          type: 6,
          TTL: 300,
          data: 'ns3.cloudflare.com. dns.cloudflare.com. 2419984191 10000 2400 604800 300',
        },
        {
          name: 'cloudflare.com',
          type: 46,
          TTL: 300,
          data: 'SOA 13 2 300 1794645238 1794465238 34505 cloudflare.com. Gy2TbSyR+pqktrZHQ/8FKINCuEjUg43U5hd8lmEkHooU/0bbHjJN+rCnYAV0qwRgm0KzktaRbx8P7ISlalXGgQ==',
        },
        {
          name: '_recon-x7.cloudflare.com',
          type: 47,
          TTL: 300,
          data: '\\000._recon-x7.cloudflare.com. RRSIG NSEC NXNAME',
        },
        {
          name: '_recon-x7.cloudflare.com',
          type: 46,
          TTL: 300,
          data: 'NSEC 13 3 300 1794645238 1794465238 34505 cloudflare.com. yLjIgThSJYj/KsJn+oYNG5CbHFkPvbQMQhsHBl6328fTOVoMrjyVc065wPzwxr3fC0QdWOXiVg3KwPPM09CIxA==',
        },
      ],
    },
  },
  unsigned: {
    ds: {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: false,
      CD: false,
      Question: [
        {
          name: 'google.com',
          type: 43,
        },
      ],
      Authority: [
        {
          name: 'com',
          type: 6,
          TTL: 746,
          data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1794555066 1800 900 604800 900',
        },
        {
          name: 'com',
          type: 46,
          TTL: 746,
          data: 'SOA 13 1 900 1795159866 1794550866 65344 com. yi25+LbvMZaFFDe9ZYRJhw7m1VkN2dAIjQwaiNYZyl7GXNWY2gt30mATiDHMC0McvOndRv6JQCMDStiEzegqVQ==',
        },
        {
          name: 's84bor4dk28hnhplc218o483voood5d8.com',
          type: 50,
          TTL: 746,
          data: '1 1 0 - S84BR9CIB2A20L3ETR1M2415ENPP99L8 NS DS RRSIG',
        },
        {
          name: 's84bor4dk28hnhplc218o483voood5d8.com',
          type: 46,
          TTL: 746,
          data: 'NSEC3 13 2 900 1795051350 1794442350 65344 com. KJ9q5OL4j8IAs9J49E/MTFz292MUTBf1KPzZAK/cHTgzVFrmTP2+3LeYLykBzDlTzCFXL1Isi/mB+ctpMp0SAg==',
        },
        {
          name: 'ck0pojmg874ljref7efn8430qvit8bsm.com',
          type: 50,
          TTL: 746,
          data: '1 1 0 - CK0Q35HRS4H76G6CHNB9414CJN6S5UPL NS SOA RRSIG DNSKEY NSEC3PARAM',
        },
        {
          name: 'ck0pojmg874ljref7efn8430qvit8bsm.com',
          type: 46,
          TTL: 746,
          data: 'NSEC3 13 2 900 1794961565 1794352565 65344 com. ZlJH4zBTd8732a1sdMrM1t1uuJ5HV9bhZ2nkKH/fObF0lZ4F2Xq3/iVyjLN99usMe6ipC1s+h7vgkJN6UzsdYA==',
        },
      ],
    },
  },
  bogus: {
    soa: {
      Status: 2,
      TC: false,
      RD: true,
      RA: true,
      AD: false,
      CD: false,
      Question: [
        {
          name: 'dnssec-failed.org',
          type: 6,
        },
      ],
      Comment: [
        'EDE(9): DNSKEY Missing no SEP matching the DS found for dnssec-failed.org.',
      ],
    },
    soaUnchecked: {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: false,
      CD: true,
      Question: [
        {
          name: 'dnssec-failed.org',
          type: 6,
        },
      ],
      Answer: [
        {
          name: 'dnssec-failed.org',
          type: 6,
          TTL: 300,
          data: 'dns101.comcast.org. dnsadmin.comcast.net. 2010102615 900 180 604800 7200',
        },
        {
          name: 'dnssec-failed.org',
          type: 46,
          TTL: 86400,
          data: 'SOA 13 2 86400 1795053426 1794437526 32784 dnssec-failed.org. 7D4rEok2j74SEU33NcfH+4SwFEbkJ+RiHyOYbMv3X2T2xiuUNFzzyukojvNgvdXbRSbWY+ueEpDT8IGPFnzkvQ==',
        },
      ],
      Comment: [
        'EDE(9): DNSKEY Missing no SEP matching the DS found for dnssec-failed.org.',
      ],
    },
  },
  nxdomain: {
    Status: 3,
    TC: false,
    RD: true,
    RA: true,
    AD: false,
    CD: false,
    Question: [
      {
        name: 'nonexistent-zzzq123.com',
        type: 6,
      },
    ],
    Authority: [
      {
        name: 'com',
        type: 6,
        TTL: 900,
        data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1794555201 1800 900 604800 900',
      },
      {
        name: 'com',
        type: 46,
        TTL: 900,
        data: 'SOA 13 1 900 1795160001 1794551001 65344 com. t1FoSzQcqDPPZyzcNyIT0gDfXqfTm1QieuP2V18x51QpU5zmGqus+sfyOcUknYLrSsWtAwBVHVPV4li+Zl9Ijw==',
      },
      {
        name: 'OMADL6M6Q3JJ36O881C2UVQDDDQELVFH.com',
        type: 50,
        TTL: 900,
        data: '1 1 0 - OMADQA7IHB5DQRA91NM9N8J18J2BCH4I NS DS RRSIG',
      },
      {
        name: 'OMADL6M6Q3JJ36O881C2UVQDDDQELVFH.com',
        type: 46,
        TTL: 900,
        data: 'NSEC3 13 2 900 1795144749 1794535749 65344 com. /vVtmA9kj20MB5XAR8BYy6TlY5o1ybBpCZufWiPI8akNWF9AjNM3jxeE0aCJ9/s+i/UjpI/vMtQgf63uPNizLQ==',
      },
      {
        name: 'CK0POJMG874LJREF7EFN8430QVIT8BSM.com',
        type: 50,
        TTL: 900,
        data: '1 1 0 - CK0Q35HRS4H76G6CHNB9414CJN6S5UPL NS SOA RRSIG DNSKEY NSEC3PARAM',
      },
      {
        name: 'CK0POJMG874LJREF7EFN8430QVIT8BSM.com',
        type: 46,
        TTL: 900,
        data: 'NSEC3 13 2 900 1794961565 1794352565 65344 com. ZlJH4zBTd8732a1sdMrM1t1uuJ5HV9bhZ2nkKH/fObF0lZ4F2Xq3/iVyjLN99usMe6ipC1s+h7vgkJN6UzsdYA==',
      },
      {
        name: '3RL2Q58205687C8I9KC9MV46DGHCNS45.com',
        type: 50,
        TTL: 900,
        data: '1 1 0 - 3RL2VRNHRTNQP2ACB7JK3K0OGV4ST3U3 NS DS RRSIG',
      },
      {
        name: '3RL2Q58205687C8I9KC9MV46DGHCNS45.com',
        type: 46,
        TTL: 900,
        data: 'NSEC3 13 2 900 1794875158 1794266158 65344 com. xgeDM/j1NT+pcggQ7pLRrRn2RNIFrtf7i2J5GsJCQcsV1HmNA+cn0C7KYJp80lqAMCSHsNvnZ3RPPPaz3w8guw==',
      },
    ],
  },
} satisfies {
  cloudflare: Record<'ds' | 'dnskey' | 'soa' | 'nonexistent', DohResponse>;
  unsigned: { ds: DohResponse };
  bogus: { soa: DohResponse; soaUnchecked: DohResponse };
  nxdomain: DohResponse;
};
