# Tools reference

**Mode** tells you who the tool talks to:

- **passive:** only public third parties (DNS resolvers, RDAP, certificate transparency logs).
  The target does not see your requests.
- **active:** connects to the target itself. Only use against systems you may test.
- **local:** inspects the surroundings of the machine running the API. No target.

Every remote tool takes a `target` and can be deep-linked with `?target=`. Option names below
are the JSON fields of the [HTTP API](api.md); defaults apply when a field is left out.

| Code | Tool                                                      | Mode    | Target                        |
| ---- | --------------------------------------------------------- | ------- | ----------------------------- |
| D-01 | [DNS Recon](#d-01-dns-recon)                              | passive | domain                        |
| D-02 | [Subdomain Finder](#d-02-subdomain-finder)                | passive | domain                        |
| D-03 | [Email Security](#d-03-email-security)                    | passive | domain                        |
| D-04 | [Zone Transfer](#d-04-zone-transfer)                      | active  | domain                        |
| D-05 | [DNSSEC Check](#d-05-dnssec-check)                        | passive | domain                        |
| D-06 | [Subdomain Takeover](#d-06-subdomain-takeover)            | active  | domain                        |
| I-01 | [WHOIS / RDAP](#i-01-whois--rdap)                         | passive | domain or IP                  |
| I-02 | [IP Intel](#i-02-ip-intel)                                | passive | IP or domain                  |
| I-03 | [CVE Lookup](#i-03-cve-lookup)                            | passive | product + version             |
| I-04 | [Org Cert Search](#i-04-org-cert-search)                  | passive | organisation name             |
| I-05 | [Reverse IP](#i-05-reverse-ip)                            | passive | IP or domain                  |
| I-06 | [Cloud Storage](#i-06-cloud-storage)                      | active  | domain                        |
| I-07 | [Passive Exposure](#i-07-passive-exposure)                | passive | IP or domain                  |
| I-08 | [Dev Footprint](#i-08-dev-footprint)                      | passive | organisation handle or domain |
| I-09 | [DNSBL Reputation](#i-09-dnsbl-reputation)                | passive | IPv4 or domain                |
| W-01 | [HTTP Inspector](#w-01-http-inspector)                    | active  | URL or domain                 |
| W-02 | [TLS Inspector](#w-02-tls-inspector)                      | active  | host                          |
| W-03 | [Web Files](#w-03-web-files)                              | active  | URL or domain                 |
| W-04 | [Tech Fingerprint](#w-04-tech-fingerprint)                | active  | URL or domain                 |
| W-05 | [Wayback URLs](#w-05-wayback-urls)                        | passive | domain                        |
| W-06 | [CORS Check](#w-06-cors-check)                            | active  | URL or domain                 |
| W-07 | [TLS Audit](#w-07-tls-audit)                              | active  | host                          |
| W-08 | [JS Endpoints](#w-08-js-endpoints)                        | active  | URL or domain                 |
| W-09 | [Exposed Files](#w-09-exposed-files)                      | active  | URL or domain                 |
| W-10 | [Cookie Audit](#w-10-cookie-audit)                        | active  | URL or domain                 |
| W-11 | [HTTP Methods & Misconfig](#w-11-http-methods--misconfig) | active  | URL or domain                 |
| W-12 | [WAF / CDN Detect](#w-12-waf--cdn-detect)                 | active  | URL or domain                 |
| W-13 | [Favicon Hash](#w-13-favicon-hash)                        | active  | URL or domain                 |
| W-14 | [API Discovery](#w-14-api-discovery)                      | active  | URL or domain                 |
| W-15 | [Dir Buster](#w-15-dir-buster)                            | active  | URL or domain                 |
| W-16 | [Gobuster](#w-16-gobuster)                                | active  | URL or domain                 |
| N-01 | [Port Probe](#n-01-port-probe)                            | active  | host                          |
| N-02 | [Host Scan](#n-02-host-scan)                              | local   | none                          |
| N-03 | [Banner Grab](#n-03-banner-grab)                          | active  | host                          |
| N-04 | [Nmap Scan](#n-04-nmap-scan)                              | active  | host                          |
| N-05 | [Network Scan](#n-05-network-scan)                        | active  | network (CIDR) or IP          |
| R-01 | [WiFi Scanner](#r-01-wifi-scanner)                        | local   | none                          |
| R-02 | [Bluetooth Scanner](#r-02-bluetooth-scanner)              | local   | none                          |

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
nameserver).
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
error message, so it is active.

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

### I-07 Passive Exposure

For an IP, or each address a domain resolves to (max 8), asks Shodan's free
[InternetDB](https://internetdb.shodan.io) what it has seen: open ports, product CPEs,
hostnames, tags and CVE ids. No API key needed, and the target itself is never contacted; the
data comes from Shodan's own scans and can be days or weeks old. Findings:

- Ports that should rarely face the internet: Telnet, SMB, NetBIOS, MS RPC, RDP, VNC, databases
  (MySQL, PostgreSQL, MS SQL, Oracle, MongoDB, Redis, Elasticsearch, CouchDB, Memcached), the
  Docker API, etcd and the Kubelet API are a `fail`; FTP is a warning.
- CVE ids matched from banners are a warning: they are unverified (backported fixes are common),
  so confirm them with [CVE Lookup](#i-03-cve-lookup).
- Shodan tags `compromised`, `malware` and `c2` are a `fail`; `eol-os`, `eol-product` and
  `self-signed` are warnings.

An address missing from InternetDB is reported as `info`: absence is not proof that nothing is
exposed. Run [Nmap Scan](#n-04-nmap-scan) to check for real (that one is active).

### I-08 Dev Footprint

For an organisation handle (`acme`) or a domain (`acme.com` becomes `acme`; two-part suffixes
like `co.uk` are handled), checks the public developer platforms:

- **GitHub:** the organisation (or notes when the handle is a personal account), its verified
  domain flag and up to 30 public repositories, most recently pushed first.
- **GitLab:** the group and up to 30 public projects.
- **npm:** the `@handle` scope and its packages, and whether an unscoped package named `handle`
  exists.
- **PyPI:** whether a package named `handle` exists.
- **Docker Hub:** the namespace and up to 30 public images.

Repositories and images untouched for two years are a warning (stale code and images keep
accumulating vulnerabilities). An npm or PyPI package with the organisation's name that is not
linked to it (owner, repository or homepage) is a warning: if the organisation uses that name
internally, builds could pull the public package (dependency confusion). An unclaimed npm scope
or package name is reported as `info`.

Organisation level only: no member lists, commit authors or personal profiles. GitHub allows
60 requests per hour without a token; when the limit is hit, that platform shows an error and
the others still report.

### I-09 DNSBL Reputation

Looks the target up on DNS blocklists: an IPv4 address (or each IPv4 address of a domain, up
to 4) on Spamhaus ZEN, SpamCop, Barracuda, PSBL and UCEPROTECT level 1, and a domain also on
Spamhaus DBL and SURBL. Return codes are decoded (SBL, XBL, DROP, DBL phishing/malware, SURBL
categories). A Spamhaus PBL entry only means "end-user range, should not send mail directly"
and is reported as information, not as a listing. Only DNS queries are made; the target is
never contacted. IPv6 addresses are listed but not checked.

Spamhaus refuses queries that reach it through large public resolvers (Cloudflare, Google,
Quad9) and answers with an error code, which the tool reports as `refused`. The API uses the
host's resolver, so results depend on where the API runs: an ISP or local resolver works,
a host whose DNS goes to a public resolver will show refusals. Barracuda may also ignore
unregistered resolvers.

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

### W-10 Cookie Audit

Follows the redirect chain hop by hop (login redirects often set the session) and grades every
`Set-Cookie`: `Secure`, `HttpOnly`, `SameSite` (`None` without `Secure` fails), the `__Host-` /
`__Secure-` prefix rules, `Domain` scope and lifetime. Cookies whose name looks like a session
or credential (`sess`, `sid`, `auth`, `token`, `jwt`, ...; not CSRF tokens) are judged strictly:
a missing `HttpOnly` or `Secure` is a `fail`, a lifetime over 30 days a warning. Graded A+ to F;
a site without cookies has no grade. Cookie values are never stored, only their length; at
most 50 cookies are audited.

### W-11 HTTP Methods & Misconfig

Read-only checks of the HTTP setup, on the URL after redirects:

- **Methods:** `OPTIONS` and the advertised `Allow` list; TRACE, PUT, DELETE and WebDAV methods
  are flagged. PUT and DELETE are never sent.
- **TRACE:** one `TRACE` request with a random marker header; an echoed marker means Cross-Site
  Tracing is possible (`fail`).
- **HTTPS:** `http://<host>/` must redirect to an `https://` URL; no plain-HTTP listener at all is
  fine.
- **HSTS:** header, `max-age` (180 days minimum, one year for preload), preload readiness and the
  host's (or a parent domain's) status on the preload list from `hstspreload.org` (only the
  hostname is sent there).
- **Error page:** a random non-existent path is requested; version banners, stack traces,
  framework debug pages and SQL errors in the response are warnings, a `200` answer is reported
  as a soft 404.
- **Default page:** nginx, Apache, IIS, Tomcat and Caddy install pages.

### W-12 WAF / CDN Detect

Recognises CDNs, WAFs and hosting edges from response headers, cookies and block pages:
Cloudflare, Akamai, Amazon CloudFront, AWS WAF and ELB, Fastly, Imperva, Sucuri, F5 BIG-IP
(and ASM), Azure Front Door and Application Gateway, Google Cloud, Vercel, Netlify, Fly.io,
Heroku, GitHub, Barracuda, FortiWeb, Citrix NetScaler, ModSecurity, Wordfence, DDoS-Guard,
Bunny CDN, KeyCDN and Varnish. Only stable markers are used; a plain `403` names no product.

| Option  | Default | Values                                                                |
| ------- | ------- | --------------------------------------------------------------------- |
| `probe` | `true`  | Also send one request with an attack-looking query string (see below) |

The trigger request (like wafw00f) adds inert SQL injection, XSS and path traversal strings to
the query string. A `4xx` or a dropped connection where the normal request worked counts as
blocked; many WAFs only reveal themselves on their block page. Turn it off to send a single
plain GET.

### W-13 Favicon Hash

Downloads `/favicon.ico` and the icons linked from the page (`<link rel="icon">`, Apple touch
icons, inline `data:` icons; max 5, 1 MB each) and computes the Shodan-style MurmurHash3 (mmh3
of the base64 text with 76-character lines), MD5 and SHA-256. Each icon comes with ready-made
queries (`http.favicon.hash:` for Shodan, `icon_hash=` for FOFA, the MD5 for Censys) that find
other hosts serving the same app, which often reveals origin servers behind a CDN. Catch-all
HTML pages served instead of a missing icon are recognised and skipped. The tool computes
hashes only; it does not query the search engines.

### W-14 API Discovery

Checks a fixed list of 21 well-known locations on the origin (and below the URL's path, if
it has one): OpenAPI/Swagger specs (`/openapi.json`, `/swagger.json`, `/v2/api-docs`,
`/v3/api-docs`, ... in JSON or YAML), Swagger UI and ReDoc pages, and GraphQL endpoints
(`/graphql`, `/api/graphql`, `/v1/graphql`). Every hit is verified by content, so catch-all
pages don't count. Specs are parsed: version, title, servers, the endpoint list (max 500) and
whether authentication is declared at all (a public spec without any security scheme is a
warning). GraphQL endpoints get one read-only introspection query; an answer with the schema
(query and mutation names) is a warning. This is a fixed list, not a path brute force.

### W-15 Dir Buster

Directory and file discovery in the style of DirBuster or gobuster: requests every word of a
built-in wordlist below the base URL (`https://example.com/app` scans `/app/<word>`), bare
and with the chosen extensions, and lists what exists with status, size, content type, page
title and redirect target. Directories (a redirect to `<word>/`, or a generated index) are
followed once to show what they answer, and with a depth of 2 or 3 scanned themselves.

| Option       | Default | Values                                                                    |
| ------------ | ------- | ------------------------------------------------------------------------- |
| `wordlist`   | `quick` | `quick` (about 100 words) or `common` (about 350)                         |
| `extensions` | none    | up to 5 of `php html txt json xml js asp aspx jsp bak old zip sql`        |
| `extraWords` | none    | up to 200 extra words, one path segment each (letters, digits, `. _ ~ -`) |
| `depth`      | `1`     | 1-3; levels below the base URL to scan (max 20 directories per level)     |
| `threads`    | `5`     | 1-10 parallel requests                                                    |

Every directory is first calibrated with random paths: when unknown paths don't answer 404
(single-page apps, catch-all redirects to a login, soft 404s), only responses that differ from
that answer are kept, and the directory is listed under `wildcardDirs`. Statuses 400, 404 and
410 mean "not there"; everything else (2xx, redirects, 401/403, 5xx) is a hit.

Findings: a directory listing and a reachable backup, dump or archive (`.bak`, `.old`, `.zip`,
`.sql`, `.tar`, `.gz`, ...) are warnings; other hits are information. Plain `GET` requests
only, no redirects followed (other than into found directories). A scan stops early, keeping
what it found, after 3000 requests, after 3 minutes, or after ten `429 Too Many Requests`
answers (`stopped` says which).

### W-16 Gobuster

Runs [gobuster](https://github.com/OJ/gobuster) `dir` on the API host (install it with
`sudo apt install gobuster` or `brew install gobuster`). Like Nmap Scan, gobuster connects to
the target's resolved IP; the hostname is sent as the `Host` header, and HTTPS certificate
checks are off because the certificate names the host, not the IP. Sites that need the
hostname in the TLS handshake (SNI, common behind CDNs) may fail; use Dir Buster for those.

| Option             | Default          | Values                                                                 |
| ------------------ | ---------------- | ---------------------------------------------------------------------- |
| `wordlist`         | `builtin-common` | an id from `GET /api/tools/gobuster/wordlists`                         |
| `extensions`       | none             | up to 5 of `php html txt json xml js asp aspx jsp bak old zip sql`     |
| `threads`          | `10`             | 1-50                                                                   |
| `timeLimitMinutes` | `10`             | 1-30; gobuster is stopped then and the paths found so far are returned |
| `excludeLengths`   | none             | up to 10 response sizes to ignore (`--exclude-length`)                 |

Wordlists are the built-in Dir Buster lists plus lists found at fixed install paths: dirb
(`common`, `big`), DirBuster (`directory-list-2.3-small`, `-medium`) and SecLists
(`Web-Content/common`, `quickhits`, `raft-small/medium-directories`, `raft-small-files`;
`sudo apt install seclists`). The client only sends an id, never a path. When random paths
don't answer 404, gobuster refuses to run; the error names the response size to put into
"Exclude lengths". Backups and archives found are warnings, other paths information.

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
ones only the /24 around the interface address (`limitedFrom` names the full subnet). Runs on the
API host.

| Option      | Default                          | Values                                                  |
| ----------- | -------------------------------- | ------------------------------------------------------- |
| `interface` | first non-virtual IPv4 interface | an interface from `GET /api/tools/host-scan/interfaces` |

As root nmap uses ARP and reports MAC addresses; unprivileged
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

Runs `nmap` against the target's resolved IP (the hostname never reaches nmap):
TCP connect scan (`-sT -Pn -n --open`) with optional service and version detection (`-sV`). No
NSE scripts. Lists open ports with service, product, version, extra info and CPEs, links
versions to CVE Lookup and records one `info` finding per open port.

| Option             | Default | Values                                         |
| ------------------ | ------- | ---------------------------------------------- |
| `topPorts`         | `100`   | `100` or `1000` (nmap's most common TCP ports) |
| `ports`            | not set | 1-1000 explicit ports; replaces `topPorts`     |
| `serviceDetection` | `true`  | `false` for a plain port scan (faster)         |

Runs nmap on the API host. Scans
have no time limit and any number can run at the same time; a large scan with version
detection can take several minutes.

### N-05 Network Scan

Runs an `nmap -sn` ping sweep (no port scan) over the network you enter, in CIDR notation; a
bare IP is treated as a /32. Ranges larger than a /22 (1024 addresses) are refused. Lists only
hosts whose answer proves they are online (ICMP echo or timestamp replies, SYN/ACKs, UDP
responses, port or protocol unreachables): TCP resets and ARP replies are ignored, because NAT
layers, firewalls and proxy ARP produce them for every address in a range. Each host comes
with its MAC address and NIC vendor when nmap sees them (same Ethernet segment only), and a
best-effort device guess from the vendor (router, printer, IoT, virtual machine, ...).

Unlike [Host Scan](#n-02-host-scan), the range is yours to choose, and the tool is active. Runs nmap on the API host with no time limit. ARP and
raw ICMP need root or the `cap_net_raw` capability.

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
