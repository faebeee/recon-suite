# Security model

Recon Suite makes outbound connections on behalf of whoever can reach its API. It does not
block internal targets, so anyone who can reach the API can use it as a proxy into your
internal network (SSRF). Keep it on your own machine. The protections below are built in.

## Authorised use

Use the tools only against systems you own or have written permission to test.

- **Passive** tools only query public services (DNS resolvers incl. Cloudflare DNS-over-HTTPS,
  rdap.org, crt.sh, Team Cymru, the Internet Archive, NVD, SecurityTrails).
- **Active** tools connect to the target. The UI marks them and shows an authorisation notice.
- The toolkit deliberately stays at the level of standard reconnaissance: no exploitation, no
  credential brute-forcing, no flooding and no evasion features.

## Target resolution

Every connection to a user-supplied target goes through `TargetGuardService`, which resolves the
host (404 when it does not resolve). Loopback, private, link-local (including cloud metadata
at `169.254.169.254`) and reserved addresses are **not** blocked.

- HTTP tools use the guard as their DNS lookup, so redirects are resolved the same way.
- Raw TCP/TLS tools connect to the resolved IP, never to the hostname.

## Access

- **There is no login.** Anyone who can reach the API (or the UI in front of it) can use every
  tool and read every engagement. Access control is the network: compose publishes only the bundled
  reverse proxy, on `127.0.0.1`. Do not expose it, and do not publish it beyond loopback (or put
  another proxy in front) without adding your own authentication there.
- **CSRF:** state-changing requests from browser origins other than `CORS_ORIGIN` are rejected,
  so other web pages open in your browser cannot start scans through the API.

## Engagement scope

Inside an engagement, active tools only run against targets in its scope (exact domains,
`*.` wildcards, IPs, CIDR ranges; exclusions win). This guards against typos and scope creep in
a real assessment. It is checked on the tool's target (and Subdomain Takeover's extra hosts),
not on every connection a tool makes afterwards: redirects to other hosts, nameservers found by
Zone Transfer, and the cloud endpoints of Cloud Storage are not scope-checked. They are still
subject to the target guard above.

## Limits

| Limit          | Value                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Rate limit     | None                                                                                                        |
| Timeouts       | Every outbound call, e.g. 8-12 s for target requests, 15 s RDAP, 45 s crt.sh. nmap scans have no time limit |
| Response size  | Capped per tool (e.g. 64 KB security.txt, 2 MB sitemap, 1 MB HTML read, 50 MB crt.sh)                       |
| Ports per scan | 64                                                                                                          |
| Redirects      | 5 to 10 depending on the tool                                                                               |
| Concurrency    | Bounded worker pools for multi-request tools (DKIM selectors, IP Intel)                                     |
| Input          | Every request is validated against a strict schema; lists are capped                                        |

## Local commands

Local tools and Nmap Scan run fixed OS commands (`nmap`, `ip`, `nmcli`, `netsh`,
`bluetoothctl`, the macOS helper) with hard-coded argument lists and never through a shell.
In the containers the API image is built on Kali and runs `nmap`/`ip` itself, as root inside
its container with only `NET_RAW`/`NET_ADMIN` added (no container-engine socket). A user-chosen value, such as
an interface name, becomes an argument only after strict validation and a check that the OS
actually reported it.

## Deployment advice

- Run it for a single operator on their own machine. If others must reach it, put it behind a
  VPN or an authenticating reverse proxy; never expose it publicly.
- Internal targets are always reachable and local tools (WiFi, Bluetooth, Host Scan) are always
  on, so never share the API with people who should not see your network or surroundings.
- The database (`DATABASE_PATH`) contains assessment results: store and back it up like other
  confidential engagement data.
- Third-party API keys (`NVD_API_KEY`, `SECURITYTRAILS_API_KEY`) are only sent to their
  providers. Reverse IP sends the target IP to SecurityTrails; CVE Lookup sends product names
  to the NVD.
- The dashboard's internet check (`GET /api/system/host`, cached 30 s) resolves
  `cloudflare.com` and requests `https://1.1.1.1/cdn-cgi/trace`, which reveals the API host's
  public IP to Cloudflare. It also shows the host's IPs, MACs and gateway, so keep the API private.
- There is no rate limit on tool requests and no time or parallelism limit on nmap scans:
  don't expose the API to untrusted users.
- Set `CORS_ORIGIN` to exactly the origin of your web app.
