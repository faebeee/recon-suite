# Tools reference

**Mode** tells you who the tool talks to:

- **passive:** only public third parties (DNS resolvers, RDAP, certificate transparency logs).
  The target does not see your requests.
- **active:** connects to the target itself. Only use against systems you may test.
- **local:** inspects the surroundings of the machine running the API. No target.

Every remote tool takes a `target` and can be deep-linked with `?target=`. Option names below
are the JSON fields of the [HTTP API](api.md); defaults apply when a field is left out.

| Code | Tool                                           | Mode    | Target            |
| ---- | ---------------------------------------------- | ------- | ----------------- |
| D-01 | [DNS Recon](#d-01-dns-recon)                   | passive | domain            |
| D-02 | [Subdomain Finder](#d-02-subdomain-finder)     | passive | domain            |
| D-03 | [Email Security](#d-03-email-security)         | passive | domain            |
| D-04 | [Zone Transfer](#d-04-zone-transfer)           | active  | domain            |
| D-05 | [DNSSEC Check](#d-05-dnssec-check)             | passive | domain            |
| D-06 | [Subdomain Takeover](#d-06-subdomain-takeover) | active  | domain            |
| I-01 | [WHOIS / RDAP](#i-01-whois--rdap)              | passive | domain or IP      |
| I-02 | [IP Intel](#i-02-ip-intel)                     | passive | IP or domain      |
| I-03 | [CVE Lookup](#i-03-cve-lookup)                 | passive | product + version |
| I-04 | [Org Cert Search](#i-04-org-cert-search)       | passive | organisation name |
| I-05 | [Reverse IP](#i-05-reverse-ip)                 | passive | IP or domain      |
| I-06 | [Cloud Storage](#i-06-cloud-storage)           | active  | domain            |
| W-01 | [HTTP Inspector](#w-01-http-inspector)         | active  | URL or domain     |
| W-02 | [TLS Inspector](#w-02-tls-inspector)           | active  | host              |
| W-03 | [Web Files](#w-03-web-files)                   | active  | URL or domain     |
| W-04 | [Tech Fingerprint](#w-04-tech-fingerprint)     | active  | URL or domain     |
| W-05 | [Wayback URLs](#w-05-wayback-urls)             | passive | domain            |
| W-06 | [CORS Check](#w-06-cors-check)                 | active  | URL or domain     |
| W-07 | [TLS Audit](#w-07-tls-audit)                   | active  | host              |
| W-08 | [JS Endpoints](#w-08-js-endpoints)             | active  | URL or domain     |
| W-09 | [Exposed Files](#w-09-exposed-files)           | active  | URL or domain     |
| N-01 | [Port Probe](#n-01-port-probe)                 | active  | host              |
| N-02 | [Host Scan](#n-02-host-scan)                   | local   | none              |
| N-03 | [Banner Grab](#n-03-banner-grab)               | active  | host              |
| R-01 | [WiFi Scanner](#r-01-wifi-scanner)             | local   | none              |
| R-02 | [Bluetooth Scanner](#r-02-bluetooth-scanner)   | local   | none              |

Tools that grade or flag something return **findings** (pass, warn, fail, info). Inside an
[engagement](using-the-ui.md#engagements) they are collected for the report.

Targets are normalised: `https://Example.com/path` becomes `example.com` for domain tools, and
a URL without a scheme gets `https://`.

---

## DNS

### D-01 DNS Recon

Queries A, AAAA, CNAME, MX, NS, TXT, SOA and CAA records.

| Option     | Default      | Values                                    |
| ---------- | ------------ | ----------------------------------------- |
| `types`    | all eight    | any subset of the record types above      |
| `resolver` | `cloudflare` | `cloudflare`, `google`, `quad9`, `system` |

Returns the records per type; a type that failed for another reason than "no data" carries an
error code. A domain that does not exist returns 404 (NXDOMAIN).

### D-02 Subdomain Finder

Lists subdomains found in public certificate transparency logs via crt.sh, with first/last
seen dates, certificate count and whether the name appeared as a wildcard.

| Option           | Default | Meaning                                      |
| ---------------- | ------- | -------------------------------------------- |
| `includeExpired` | `false` | Also include names from expired certificates |

crt.sh can be slow for large domains; the request times out after 45 seconds.

### D-03 Email Security

Grades how well a domain is protected against mail spoofing, using DNS only.

- **SPF:** the record, its `all` policy, and the number of DNS lookups a receiver needs,
  following nested `include:` and `redirect=` (the RFC limit is 10; more breaks SPF). Detects
  multiple SPF records, include loops and missing includes.
- **DMARC:** policy, subdomain policy, `pct`, report addresses (`rua`, `ruf`). Falls back to
  parent domains, as receivers do.
- **DKIM:** probes 16 common selectors (`default`, `google`, `selector1`, `selector2`, `k1`,
  `s1`, ...) plus your own, and reports key type and RSA key size.
- **MTA-STS, TLS-RPT, BIMI:** whether the DNS records exist. The MTA-STS policy file is not
  fetched, because that would contact the target.

| Option          | Default | Meaning                                                |
| --------------- | ------- | ------------------------------------------------------ |
| `dkimSelectors` | `[]`    | Up to 10 extra selectors to probe, e.g. `["mail2024"]` |

The result has a grade (A+ to F) and a list of pass/warn/fail/info findings. Notable rules:
`~all` only passes with an enforcing DMARC policy (`quarantine` or `reject`); RSA keys under
1024 bits fail and 1024-bit keys warn; MTA-STS and TLS-RPT are only checked when the domain has
MX records. A missing DKIM key is a warning, not a failure, because the domain may use a
selector that was not probed.

### D-04 Zone Transfer

Asks every authoritative nameserver of the domain (max 6) for a full zone transfer (AXFR over
TCP). A server that sends the zone leaks every record in it, which is a finding (`fail` per
nameserver). Nameservers resolving to private addresses are reported as errors, not contacted.
Up to 500 records per nameserver are returned; the count is always complete.

Enter the zone apex (e.g. `example.com`), not a subdomain.

### D-05 DNSSEC Check

Checks DNSSEC through Cloudflare's validating DNS-over-HTTPS resolver: DS records at the parent,
DNSKEYs (KSK/ZSK, algorithm, RSA key size), RRSIG validity and NSEC/NSEC3. Status:

| Status          | Meaning                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `secure`        | Signed and the chain validates                                           |
| `insecure`      | No DS at the parent: the zone is not signed (warn)                       |
| `bogus`         | Signed but validation fails: validating resolvers return SERVFAIL (fail) |
| `indeterminate` | Could not decide                                                         |

Deprecated algorithms (RSA/MD5, DSA, ...), SHA-1 DS digests, short RSA keys and expiring
signatures are flagged.

### D-06 Subdomain Takeover

Takes subdomains from certificate transparency (or only your list), follows each CNAME chain
and checks whether it points to a cloud resource that no longer exists and could be claimed by
someone else (S3, Azure, Bitbucket, Ghost, Pantheon, Surge.sh, ...). Provider fingerprints follow
the public [can-i-take-over-xyz](https://github.com/EdOverflow/can-i-take-over-xyz) list.

| Option   | Default | Values                                                       |
| -------- | ------- | ------------------------------------------------------------ |
| `source` | `ct`    | `ct` (crt.sh subdomains plus `hosts`), `list` (only `hosts`) |
| `hosts`  | `[]`    | up to 200 extra hostnames                                    |

Statuses: `vulnerable` (provider fingerprint or claimable dangling record), `likely` (dangling
CNAME, or a provider listed as "edge case"), `safe`, `unknown`. Only hosts with a CNAME or
provider match are listed. The tool fetches the page of matched hosts to look for the provider's
error message, so it is active. Inside an engagement, extra `hosts` must be in scope too.

## Intel

### I-01 WHOIS / RDAP

Registration data via RDAP (rdap.org bootstrap): registrar, status flags, lifecycle events
(registration, expiry, ...), nameservers and entities. For subdomains it walks up to the
registered domain. For IPs it returns the network: range, CIDR, country and allocation type.

### I-02 IP Intel

For an IP, or for every A/AAAA address of a domain (up to 8):

- **Reverse DNS** (PTR) and **forward confirmation**: does the PTR name resolve back to the
  same IP?
- **ASN** of the announcing network, BGP prefix, country and registry, via Team Cymru's
  IP-to-ASN DNS service.
- **Network owner** from RDAP: network name, organisation, CIDR.
- **Provider:** a tag for well-known CDNs, clouds and hosters (Cloudflare, Fastly, Akamai, AWS,
  Google, Azure, Hetzner, OVHcloud, DigitalOcean, ...), based on the ASN.

A failed sub-lookup (e.g. RDAP rate-limited) is listed per address; the other data is still
returned.

### I-03 CVE Lookup

Looks up known vulnerabilities for a product and version in the NVD, e.g. `nginx 1.18.0`,
`OpenSSH 8.9p1` or a CPE 2.3 string. Common product names are mapped to their CPE vendor and
product (OpenSSH, nginx, Apache HTTP Server, IIS, PHP, Postfix, Exim, MySQL, WordPress, ...),
others are matched with a vendor wildcard. Results show CVSS score and severity, the CISA
known-exploited flag and references, known-exploited first.

| Option  | Default | Values |
| ------- | ------- | ------ |
| `limit` | `50`    | 1-200  |

**Requires `NVD_API_KEY`** (free, [request one](https://nvd.nist.gov/developers/request-an-api-key));
without it the tool answers 503. Tech Fingerprint and Banner Grab link detected versions here.
Version matching follows NVD's data: an empty result does not prove a version is safe.

### I-04 Org Cert Search

Searches certificate transparency (crt.sh) by organisation name as it appears in certificate
subjects (`O=`), to find other domains a company owns. Returns the certificate common names and
a list of apex domains for pivots.

| Option           | Default | Meaning                                 |
| ---------------- | ------- | --------------------------------------- |
| `includeExpired` | `false` | Include names from expired certificates |

Only domain-validated certificates without an organisation are invisible to this search, and
names that only appear in SANs are not returned. crt.sh is often slow or briefly unavailable.

### I-05 Reverse IP

Lists hostnames that point to the same IP address (co-hosting), from SecurityTrails. A domain
target uses its first A (or AAAA) record. Returns up to 500 hostnames and the provider's total.
**Requires `SECURITYTRAILS_API_KEY`**; without it the tool answers 503. The IP is sent to
SecurityTrails.

### I-06 Cloud Storage

Derives up to 30 likely bucket names from the domain (`example`, `example-backup`,
`example-assets`, `example-com`, ... plus up to 10 of your own) and checks Amazon S3, Google
Cloud Storage and Azure Blob Storage for buckets that exist or allow anonymous listing. Public
listing is a `fail` finding with sample object keys; existing private buckets are reported as
info. Names are guesses: an existing bucket is not necessarily the target's.

| Option       | Default | Values                |
| ------------ | ------- | --------------------- |
| `extraNames` | `[]`    | up to 10 bucket names |

## Web

### W-01 HTTP Inspector

Requests the URL, follows redirects hop by hop and grades the security headers
(`Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`Cross-Origin-Opener-Policy`) from A+ to F. Lists headers that disclose implementation details
(`Server`, `X-Powered-By`, ...).

| Option            | Default | Values        |
| ----------------- | ------- | ------------- |
| `method`          | `GET`   | `GET`, `HEAD` |
| `followRedirects` | `true`  | boolean       |

At most 10 redirects are followed.

### W-02 TLS Inspector

Performs a TLS handshake and reports protocol version, cipher, whether the certificate chain
validates, the leaf certificate (subject, issuer, validity, days remaining, SANs, key size,
SHA-256 fingerprint) and the chain.

| Option | Default | Values                                                     |
| ------ | ------- | ---------------------------------------------------------- |
| `port` | `443`   | 1-65535 (the UI offers 443, 465, 636, 853, 993, 995, 8443) |

### W-03 Web Files

Fetches well-known files from the target's origin (only scheme, host and port of the URL are
used):

| File           | What you get                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `robots.txt`   | User-agent groups with allow/disallow rules, declared sitemaps, and a "worth a look" list of paths that hint at admin areas, backups, APIs, `.git`, staging, ...   |
| `sitemap.xml`  | Type (urlset or index), number of entries, first 25 URLs. Falls back to the first same-origin sitemap declared in robots.txt.                                      |
| `security.txt` | Fields plus RFC 9116 checks: `Contact` present, `Expires` present, valid and not past, location, `Canonical`, signature. Falls back to the legacy `/security.txt`. |
| `humans.txt`   | The first 2000 characters.                                                                                                                                         |

An HTML page returned with status 200 where a text file was expected is marked **soft 404**
and not treated as found. Errors on one file do not fail the others.

### W-04 Tech Fingerprint

Loads one page (following up to 8 redirects) and identifies the technology stack from
response headers, cookie names, the `<meta name="generator">` tag and markup patterns:
web servers, languages, frameworks (Next.js, Nuxt, Angular, Laravel, Django, Rails, ...),
CMS and site builders (WordPress, Drupal, TYPO3, Ghost, Wix, Webflow, ...), e-commerce, CDNs,
hosting platforms, JavaScript libraries, analytics and bot protection.

Each detection has a version when one is visible, a confidence (**high** for explicit headers
or the generator tag, **medium** for markup, cookies or implication) and the evidence that
matched. Only the first 1 MB of HTML is analysed. No other paths on the target are requested.

### W-05 Wayback URLs

Pulls archived URLs for the domain from the Internet Archive's CDX API and highlights:
backup and archive files, config and key files, sensitive query parameters (`token`, `key`,
`password`, `session`, ...) and admin/debug paths. Also lists the most common parameter names
and file extensions.

| Option              | Default | Values       |
| ------------------- | ------- | ------------ |
| `includeSubdomains` | `false` | boolean      |
| `limit`             | `1000`  | 10-5000 URLs |

The archive is often slow or temporarily offline; errors say so.

### W-06 CORS Check

Sends requests with crafted `Origin` headers and checks what the server allows: an arbitrary
origin, `null`, look-alike origins (`evilexample.com`, `example.com.attacker.tld`), plain HTTP
and a preflight for `PUT` with `Authorization`. Reflecting an attacker's origin together with
`Access-Control-Allow-Credentials: true` is a `fail`; reflection without credentials or without
`Vary: Origin` is a warning.

### W-07 TLS Audit

Goes further than the TLS Inspector: tests each protocol version (TLS 1.0 to 1.3) and every
cipher suite the local OpenSSL can offer, classifies them (strong, acceptable, weak, insecure),
and checks OCSP stapling, embedded certificate transparency SCTs and the key exchange. Graded
A+ to F.

| Option | Default | Values  |
| ------ | ------- | ------- |
| `port` | `443`   | 1-65535 |

Limits: an audit makes dozens of handshakes and can take up to 90 seconds. The OpenSSL bundled
with Node no longer supports RC4, 3DES, export and single-DES suites at all, so servers still
accepting those are not detected (a server accepting nothing else fails with a 502).

### W-08 JS Endpoints

Loads the page, downloads its same-site JavaScript (default 15, max 30 files; third-party
scripts are listed but not downloaded) and extracts API paths, absolute URLs and referenced
hostnames. Also reports exposed source maps (source code downloadable) and strings that look
like leaked credentials (AWS keys, Stripe secret keys, Slack and GitHub tokens, private keys;
Google API keys and JWTs as warnings). Secrets are shown masked.

| Option       | Default | Values |
| ------------ | ------- | ------ |
| `maxScripts` | `15`    | 1-30   |

### W-09 Exposed Files

Checks a fixed list of 18 classic leaks on the origin: `.git/HEAD`, `.git/config`,
`.svn/entries`, `.hg/requires`, `.env`, `.DS_Store`, `server-status`, `server-info`,
`phpinfo.php`, Spring Boot `actuator` and `actuator/env`, OpenAPI/Swagger specs,
`crossdomain.xml`, `.htaccess`, `web.config` and `wp-config.php.bak`. Each hit is verified by
its content signature, not just the status code, so catch-all pages do not count. Evidence is
a short excerpt with secret values masked. The list is deliberately fixed: this is a
misconfiguration check, not a path brute-forcer.

## Network

### N-01 Port Probe

TCP connect check: each port is `open`, `closed` (refused) or `filtered` (no answer within the
timeout).

| Option      | Default             | Values                                                                               |
| ----------- | ------------------- | ------------------------------------------------------------------------------------ |
| `ports`     | the `common` preset | 1 to 64 ports. UI presets: common, web, mail, database, custom (`22, 80, 8000-8010`) |
| `timeoutMs` | `1500`              | 250-5000                                                                             |

### N-02 Host Scan

Local tool. Runs an `nmap -sn` host sweep (no port scan) on one network interface and lists
live hosts with IP, MAC address and NIC vendor. Subnets up to /22 are swept whole; for larger
ones only the /24 around the interface address (`limitedFrom` names the full subnet). Runs in
the Kali container when `KALI_CONTAINER` is set (the interfaces are then the container's),
otherwise on the API host.

| Option      | Default                          | Values                                                  |
| ----------- | -------------------------------- | ------------------------------------------------------- |
| `interface` | first non-virtual IPv4 interface | an interface from `GET /api/tools/host-scan/interfaces` |

As root (Kali container, or a root API) nmap uses ARP and reports MAC addresses; unprivileged
it falls back to TCP probes without MACs. See
[Local tools setup](local-tools.md#host-scan).

### N-03 Banner Grab

Connects to ports where the server speaks first and reads its greeting once, without sending
anything (implicit-TLS ports 465, 636, 993, 995 complete a TLS handshake first). Identifies
SSH, FTP, SMTP, IMAP, POP3 and MySQL/MariaDB products and versions, with a link to CVE Lookup.

| Option      | Default                                        | Values     |
| ----------- | ---------------------------------------------- | ---------- |
| `ports`     | 21, 22, 25, 110, 143, 465, 587, 993, 995, 3306 | 1-16 ports |
| `timeoutMs` | `3000`                                         | 500-8000   |

States: `banner`, `silent` (connected, but the service waits for the client, e.g. HTTP),
`closed`, `filtered`, `error`.

### N-04 Nmap Scan

Runs `nmap` against the target's resolved, guard-checked IP (the hostname never reaches nmap):
TCP connect scan (`-sT -Pn -n --open`) with optional service and version detection (`-sV`). No
NSE scripts. Lists open ports with service, product, version, extra info and CPEs, links
versions to CVE Lookup and records one `info` finding per open port.

| Option             | Default | Values                                         |
| ------------------ | ------- | ---------------------------------------------- |
| `topPorts`         | `100`   | `100` or `1000` (nmap's most common TCP ports) |
| `ports`            | not set | 1-1000 explicit ports; replaces `topPorts`     |
| `serviceDetection` | `true`  | `false` for a plain port scan (faster)         |

Runs in the Kali container when `KALI_CONTAINER` is set (see
[Kali container](local-tools.md#kali-container)), otherwise needs `nmap` on the API host. Scans
have no time limit and any number can run at the same time; a large scan with version
detection can take several minutes.

## Wireless

### R-01 WiFi Scanner

Local tool. Lists the WiFi networks the API host can see: SSID, BSSID, band, channel, width,
security, signal and noise, and which one the host is connected to.

| Option      | Default                                 | Values                                             |
| ----------- | --------------------------------------- | -------------------------------------------------- |
| `interface` | the connected (or first) WiFi interface | an interface from `GET /api/tools/wifi/interfaces` |

Uses CoreWLAN via the macOS helper, `nmcli` on Linux and `netsh` on Windows. Without the
required permission, names are redacted and the UI explains how to fix it.

### R-02 Bluetooth Scanner

Local tool. Listens for Bluetooth Low Energy advertisements and runs a Classic inquiry:
name, address (macOS shows per-host UUIDs for BLE), RSSI, manufacturer, services, device class,
paired/connected state.

| Option        | Default | Values                            |
| ------------- | ------- | --------------------------------- |
| `transport`   | `both`  | `both`, `ble`, `classic`          |
| `durationSec` | `8`     | 2-20 (the UI offers 4, 8, 12, 20) |

macOS (helper app) and Linux (BlueZ `bluetoothctl`). Not implemented on Windows. Many BLE
devices rotate random addresses, so the same device can appear more than once.
