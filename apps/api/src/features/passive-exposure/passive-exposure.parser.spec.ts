import type { ExposureAddress } from '@recon/shared';
import {
  exposureFindings,
  parseInternetDb,
  riskyPorts,
} from './passive-exposure.parser.js';

const addr = (p: Partial<ExposureAddress>): ExposureAddress => ({
  ip: '192.0.2.1',
  indexed: true,
  ports: [],
  risky: [],
  cpes: [],
  hostnames: [],
  tags: [],
  vulns: [],
  ...p,
});

describe('parseInternetDb', () => {
  it('keeps valid values, sorted and de-duplicated', () => {
    expect(
      parseInternetDb({
        ip: '192.0.2.1',
        ports: [443, 80, 80, 0, 70000, 1.5, '22'],
        cpes: ['cpe:/a:nginx:nginx:1.18.0', 42],
        hostnames: ['a.example.com'],
        tags: ['cdn'],
        vulns: ['CVE-2021-23017', 'not-a-cve', 'CVE-2019-20372'],
      }),
    ).toEqual({
      ports: [80, 443],
      cpes: ['cpe:/a:nginx:nginx:1.18.0'],
      hostnames: ['a.example.com'],
      tags: ['cdn'],
      vulns: ['CVE-2019-20372', 'CVE-2021-23017'],
    });
  });

  it('rejects things that are not an InternetDB answer', () => {
    expect(
      parseInternetDb({ detail: 'No information available' }),
    ).toBeUndefined();
    expect(parseInternetDb(null)).toBeUndefined();
    expect(parseInternetDb('x')).toBeUndefined();
  });

  it('treats missing lists as empty', () => {
    expect(parseInternetDb({ ports: [22] })).toEqual({
      ports: [22],
      cpes: [],
      hostnames: [],
      tags: [],
      vulns: [],
    });
  });
});

describe('riskyPorts', () => {
  it('flags admin, database and clear-text ports only', () => {
    expect(riskyPorts([22, 23, 80, 443, 3389, 6379])).toEqual([
      { port: 23, service: 'Telnet' },
      { port: 3389, service: 'RDP' },
      { port: 6379, service: 'Redis' },
    ]);
  });
});

describe('exposureFindings', () => {
  it('passes when nothing risky is open', () => {
    const f = exposureFindings([addr({ ports: [80, 443] })]);
    expect(f).toEqual([
      expect.objectContaining({
        id: 'exposure.ports',
        status: 'pass',
        message: 'Open ports seen: 80, 443.',
      }),
    ]);
  });

  it('groups risky ports across addresses and reports CVEs and tags', () => {
    const f = exposureFindings([
      addr({
        ip: '192.0.2.1',
        ports: [3389],
        risky: riskyPorts([3389]),
        vulns: ['CVE-2021-1'],
        tags: ['eol-product', 'cloud'],
      }),
      addr({
        ip: '192.0.2.2',
        ports: [3389, 21],
        risky: riskyPorts([21, 3389]),
      }),
    ]);
    expect(f.map((x) => [x.id, x.status, x.value])).toEqual([
      ['exposure.port.21', 'warn', '192.0.2.2'],
      ['exposure.port.3389', 'fail', '192.0.2.1, 192.0.2.2'],
      ['exposure.vulns', 'warn', 'CVE-2021-1'],
      ['exposure.tag.eol-product', 'warn', '192.0.2.1'],
    ]);
  });

  it('says so when no address is indexed, and ignores failed lookups', () => {
    expect(
      exposureFindings([
        addr({ indexed: false }),
        addr({ ip: '192.0.2.9', indexed: false, error: 'boom' }),
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'exposure.indexed',
        status: 'info',
        value: '192.0.2.1',
      }),
    ]);
    expect(exposureFindings([addr({ indexed: false, error: 'boom' })])).toEqual(
      [],
    );
  });
});
