# Security model

Recon Suite makes outbound connections on behalf of whoever can reach its API. Without
safeguards that would turn it into a proxy into your internal network (SSRF) or a tool for
flooding third parties. These protections are built in.

## Authorised use

Use the tools only against systems you own or have written permission to test.

- **Passive** tools only query public services (DNS resolvers, rdap.org, crt.sh, Team Cymru).
- **Active** tools connect to the target. The UI marks them and shows an authorisation notice.
- The toolkit deliberately stays at the level of standard reconnaissance: no exploitation, no
  credential brute-forcing, no flooding and no evasion features.

## Target guard (SSRF protection)

Every connection to a user-supplied target goes through `TargetGuardService`. It resolves the
host and rejects it (403) when any address is in a blocked range:

| IPv4                                                                | IPv6                                      |
| ------------------------------------------------------------------- | ----------------------------------------- |
| `0.0.0.0/8`, `127.0.0.0/8` (this host, loopback)                    | `::`, `::1`                               |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (private)           | `fc00::/7` (unique local)                 |
| `100.64.0.0/10` (carrier-grade NAT)                                 | `fe80::/10` (link-local)                  |
| `169.254.0.0/16` (link-local, cloud metadata)                       | `ff00::/8` (multicast)                    |
| `192.0.0.0/24`, `198.18.0.0/15` (special purpose, benchmarking)     | `64:ff9b:1::/48`, `100::/64`              |
| `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` (documentation) | `2001:db8::/32` (documentation)           |
| `224.0.0.0/4`, `240.0.0.0/4` (multicast, reserved)                  | IPv4-mapped addresses are checked as IPv4 |

The guard covers more than the first request:

- **Redirects** are followed one hop at a time, and every hop is checked again, including
  redirects to raw IP addresses.
- **DNS rebinding:** HTTP connections use the guard as their DNS lookup, so the address that is
  actually connected to is the one that was checked. Raw TCP/TLS tools connect to the
  resolved, checked IP and never to the hostname.

`ALLOW_PRIVATE_TARGETS=true` disables the range check. Use it only for local, single-user setups
where you want to scan your own LAN.

## Limits

| Limit          | Value                                                                                 |
| -------------- | ------------------------------------------------------------------------------------- |
| Rate limit     | `THROTTLE_LIMIT` requests per minute per client (default 60)                          |
| Timeouts       | Every outbound call, e.g. 8-12 s for target requests, 15 s RDAP, 45 s crt.sh          |
| Response size  | Capped per tool (e.g. 64 KB security.txt, 2 MB sitemap, 1 MB HTML read, 50 MB crt.sh) |
| Ports per scan | 64                                                                                    |
| Redirects      | 5 to 10 depending on the tool                                                         |
| Concurrency    | Bounded worker pools for multi-request tools (DKIM selectors, IP Intel)               |
| Input          | Every request is validated against a strict schema; lists are capped                  |

## Local commands

Local tools run fixed OS commands (`arp-scan`, `nmcli`, `netsh`, `bluetoothctl`, the macOS
helper) with hard-coded argument lists and never through a shell. A user-chosen value, such as
an interface name, becomes an argument only after strict validation and a check that the OS
actually reported it.

## Deployment advice

- The API has **no authentication**. Run it on localhost, or put it behind an authenticating
  reverse proxy or VPN. Never expose it publicly as is.
- Keep `ALLOW_PRIVATE_TARGETS=false` and `LOCAL_TOOLS_ENABLED=false` on anything shared.
- Lower `THROTTLE_LIMIT` for multi-user setups.
- Set `CORS_ORIGIN` to exactly the origin of your web app.
