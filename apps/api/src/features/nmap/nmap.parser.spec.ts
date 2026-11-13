import { buildNmapArgs, nmapFindings, parseNmapXml } from './nmap.parser.js';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nmaprun>
<nmaprun scanner="nmap" args="nmap -sT -Pn -n --open -oX - 192.0.2.10" start="1700000000" version="7.95" xmloutputversion="1.05">
<scaninfo type="connect" protocol="tcp" numservices="100" services="7,9,13,21-23"/>
<verbose level="0"/>
<host starttime="1700000000" endtime="1700000012"><status state="up" reason="user-set" reason_ttl="0"/>
<address addr="192.0.2.10" addrtype="ipv4"/>
<ports><extraports state="closed" count="97">
<extrareasons reason="conn-refused" count="97" proto="tcp" ports="7,9"/>
</extraports>
<port protocol="tcp" portid="80"><state state="open" reason="syn-ack" reason_ttl="0"/><service name="http" product="nginx" version="1.24.0" extrainfo="Ubuntu" method="probed" conf="10"><cpe>cpe:/a:igor_sysoev:nginx:1.24.0</cpe><cpe>cpe:/o:linux:linux_kernel</cpe></service></port>
<port protocol="tcp" portid="22"><state state="open" reason="syn-ack" reason_ttl="0"/><service name="ssh" product="OpenSSH" version="9.6p1 Ubuntu 3ubuntu13" extrainfo="Ubuntu Linux; protocol 2.0" method="probed" conf="10"/></port>
<port protocol="tcp" portid="9999"><state state="open" reason="syn-ack" reason_ttl="0"/><service name="abyss" method="table" conf="3"/></port>
</ports>
</host>
<runstats><finished time="1700000012" timestr="x" summary="Nmap done" elapsed="12.34" exit="success"/><hosts up="1" down="0" total="1"/>
</runstats>
</nmaprun>`;

describe('parseNmapXml', () => {
  it('parses open ports with service details, sorted by port', () => {
    const out = parseNmapXml(XML);
    expect(out.hostState).toBe('up');
    expect(out.nmapVersion).toBe('7.95');
    expect(out.elapsedSeconds).toBe(12.34);
    expect(out.scannedPorts).toBe(100);
    expect(out.ports.map((p) => p.port)).toEqual([22, 80, 9999]);
    expect(out.ports[0]).toMatchObject({
      protocol: 'tcp',
      state: 'open',
      reason: 'syn-ack',
      service: 'ssh',
      product: 'OpenSSH',
      version: '9.6p1 Ubuntu 3ubuntu13',
      extraInfo: 'Ubuntu Linux; protocol 2.0',
      method: 'probed',
      cpe: [],
    });
    expect(out.ports[1]!.cpe).toEqual([
      'cpe:/a:igor_sysoev:nginx:1.24.0',
      'cpe:/o:linux:linux_kernel',
    ]);
    expect(out.ports[2]).toMatchObject({ service: 'abyss', method: 'table' });
  });

  it('decodes XML entities in attributes', () => {
    const out = parseNmapXml(
      '<port protocol="tcp" portid="8080"><state state="open"/><service name="http" product="Foo &amp; Bar &#x41;&#66;"/></port>',
    );
    expect(out.ports[0]!.product).toBe('Foo & Bar AB');
  });

  it('handles a host without open ports or output at all', () => {
    expect(parseNmapXml('<nmaprun version="7.95"></nmaprun>')).toEqual({
      hostState: 'unknown',
      ports: [],
      scannedPorts: 0,
      nmapVersion: '7.95',
      elapsedSeconds: undefined,
    });
  });
});

describe('buildNmapArgs', () => {
  const base = {
    address: '192.0.2.10',
    family: 4 as const,
    topPorts: 100,
    serviceDetection: false,
  };

  it('uses fixed flags, top ports and the IP as the last argument', () => {
    const args = buildNmapArgs(base);
    expect(args).toEqual([
      '-sT',
      '-Pn',
      '-n',
      '--open',
      '-T4',
      '--max-retries',
      '2',
      '--top-ports',
      '100',
      '-oX',
      '-',
      '192.0.2.10',
    ]);
    expect(args.some((a) => a.includes('script'))).toBe(false);
  });

  it('adds -sV, -6 and an explicit deduplicated port list', () => {
    const args = buildNmapArgs({
      ...base,
      address: '2001:db8::1',
      family: 6,
      serviceDetection: true,
      ports: [443, 22, 443],
    });
    expect(args).toContain('-sV');
    expect(args).toContain('-6');
    expect(args.slice(args.indexOf('-p'), args.indexOf('-p') + 2)).toEqual([
      '-p',
      '22,443',
    ]);
    expect(args).not.toContain('--top-ports');
    expect(args.at(-1)).toBe('2001:db8::1');
  });
});

describe('nmapFindings', () => {
  it('creates one info finding per open port', () => {
    const findings = nmapFindings(parseNmapXml(XML).ports);
    expect(findings).toHaveLength(3);
    expect(findings[0]).toMatchObject({
      id: 'nmap.tcp.22',
      status: 'info',
      title: '22/tcp open (ssh)',
      value: 'OpenSSH 9.6p1 Ubuntu 3ubuntu13',
    });
    expect(findings[2]!.message).toContain('no version');
  });
});
