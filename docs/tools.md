# Tools reference

**Mode** tells you who the tool talks to:

- **passive:** only public third parties (DNS resolvers, RDAP, certificate transparency logs).
  The target does not see your requests.
- **active:** connects to the target itself. Only use against systems you may test.
- **local:** inspects the surroundings of the machine running the API. No target.

Every remote tool takes a `target` and can be deep-linked with `?target=`. Option names below
are the JSON fields of the [HTTP API](api.md); defaults apply when a field is left out.

| Code | Tool                                         | Mode    | Target        |
| ---- | -------------------------------------------- | ------- | ------------- |
| D-01 | [DNS Recon](#d-01-dns-recon)                 | passive | domain        |
| D-02 | [Subdomain Finder](#d-02-subdomain-finder)   | passive | domain        |
| D-03 | [Email Security](#d-03-email-security)       | passive | domain        |
| I-01 | [WHOIS / RDAP](#i-01-whois--rdap)            | passive | domain or IP  |
| I-02 | [IP Intel](#i-02-ip-intel)                   | passive | IP or domain  |
| W-01 | [HTTP Inspector](#w-01-http-inspector)       | active  | URL or domain |
| W-02 | [TLS Inspector](#w-02-tls-inspector)         | active  | host          |
| W-03 | [Web Files](#w-03-web-files)                 | active  | URL or domain |
| W-04 | [Tech Fingerprint](#w-04-tech-fingerprint)   | active  | URL or domain |
| N-01 | [Port Probe](#n-01-port-probe)               | active  | host          |
| N-02 | [Host Scan](#n-02-host-scan)                 | local   | none          |
| R-01 | [WiFi Scanner](#r-01-wifi-scanner)           | local   | none          |
| R-02 | [Bluetooth Scanner](#r-02-bluetooth-scanner) | local   | none          |

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

## Network

### N-01 Port Probe

TCP connect check: each port is `open`, `closed` (refused) or `filtered` (no answer within the
timeout).

| Option      | Default             | Values                                                                               |
| ----------- | ------------------- | ------------------------------------------------------------------------------------ |
| `ports`     | the `common` preset | 1 to 64 ports. UI presets: common, web, mail, database, custom (`22, 80, 8000-8010`) |
| `timeoutMs` | `1500`              | 250-5000                                                                             |

### N-02 Host Scan

Local tool. Sends ARP requests with `arp-scan` on one network interface of the API host and
lists live hosts on that subnet with IP, MAC address and NIC vendor.

| Option      | Default                          | Values                                                  |
| ----------- | -------------------------------- | ------------------------------------------------------- |
| `interface` | first non-virtual IPv4 interface | an interface from `GET /api/tools/host-scan/interfaces` |

Linux and macOS only. Needs `arp-scan` and raw socket access; see
[Local tools setup](local-tools.md#host-scan).

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
