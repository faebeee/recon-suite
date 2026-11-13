# Recon Suite

A collection of reconnaissance tools with a cyberpunk HUD interface. Built as a
Turborepo monorepo with a feature-driven architecture.

![Recon Suite: the DNS Recon tool in the default Cyber theme](docs/screenshot.png)

> For authorised security assessments only. Active modules connect directly to the
> target; only probe systems you own or have permission to test.

## Tools

| Code | Tool              | Mode    | What it does                                                                             |
| ---- | ----------------- | ------- | ---------------------------------------------------------------------------------------- |
| D-01 | DNS Recon         | passive | A, AAAA, CNAME, MX, NS, TXT, SOA, CAA via Cloudflare/Google/Quad9/system                 |
| D-02 | Subdomain Finder  | passive | Subdomains from certificate transparency logs (crt.sh)                                   |
| D-03 | Email Security    | passive | SPF (nested lookup count), DMARC, DKIM keys, MTA-STS, TLS-RPT, BIMI, with a grade        |
| I-01 | WHOIS / RDAP      | passive | Registrar, lifecycle, status, nameservers; IP network ownership                          |
| I-02 | IP Intel          | passive | Reverse DNS + forward confirmation, ASN (Team Cymru), RDAP network, CDN/cloud provider   |
| W-01 | HTTP Inspector    | active  | Redirect chain, headers, security-header grade, disclosures                              |
| W-02 | TLS Inspector     | active  | Protocol, cipher, certificate, SANs, chain, expiry                                       |
| W-03 | Web Files         | active  | robots.txt (notable paths), sitemap.xml, security.txt (RFC 9116 checks), humans.txt      |
| W-04 | Tech Fingerprint  | active  | Server, language, framework, CMS, CDN, libraries from headers, cookies and HTML          |
| N-01 | Port Probe        | active  | TCP connect check on preset or custom ports (max 64)                                     |
| N-02 | Host Scan         | local   | ARP discovery of live hosts and MAC vendors on the API host's subnet (arp-scan)          |
| R-01 | WiFi Scanner      | local   | Nearby WiFi networks seen by the API host: SSID, band, channel, security, signal         |
| R-02 | Bluetooth Scanner | local   | BLE advertisements + Classic inquiry: name, vendor, class, RSSI, services (macOS, Linux) |

Results link to each other ("pivots"): a hostname found in DNS, CT logs or a certificate
can be opened in any other compatible tool with one click. Every tool also accepts
`?target=` in the URL, e.g. `/tools/dns?target=example.com`. Two themes are built in:
**Cyber** (default) and **Nothing** (monochrome, dot-matrix), switchable in the top bar.

## Documentation

| Page                                       | Contents                                              |
| ------------------------------------------ | ----------------------------------------------------- |
| [Getting started](docs/getting-started.md) | Install, development, containers, troubleshooting     |
| [Using the UI](docs/using-the-ui.md)       | Tool pages, pivots, deep links, themes                |
| [Tools reference](docs/tools.md)           | Every tool with options, data sources and limits      |
| [HTTP API](docs/api.md)                    | Endpoints, response envelope, errors, `curl` examples |
| [Configuration](docs/configuration.md)     | Environment variables                                 |
| [Local tools setup](docs/local-tools.md)   | WiFi, Bluetooth, Host Scan per OS; macOS helper       |
| [Security model](docs/security.md)         | Target guard, limits, deployment advice               |
| [Architecture](docs/architecture.md)       | Monorepo, feature slices, request flow                |

## Stack

| Path              | Package         | Stack                                                          |
| ----------------- | --------------- | -------------------------------------------------------------- |
| `apps/api`        | `@recon/api`    | NestJS 12 (ESM), Zod validation, undici, throttler, Vitest     |
| `apps/web`        | `@recon/web`    | Vite, React 19, TanStack Router + Query, Tailwind 4, shadcn/ui |
| `packages/shared` | `@recon/shared` | Zod schemas, types and tool catalog used by both apps          |

## Getting started

Requirements: Node 24+, pnpm 11, Podman (for containers).

```sh
pnpm install
pnpm dev        # api http://localhost:4000, web http://localhost:5173
```

```sh
pnpm build | typecheck | lint | test
pnpm --filter @recon/api test:e2e
pnpm compose:up     # web http://localhost:8080 (nginx + api)
pnpm compose:down
```

Configuration: see `.env.example`, `apps/api/.env.example` and `apps/web/.env.example`.

> **Local tools** (WiFi, Bluetooth, Host Scan) inspect the machine running the API and are off
> by default in containers. On macOS run `pnpm setup:macos-helper` once. Details per OS:
> [docs/local-tools.md](docs/local-tools.md).

## Security model

- Every connection to a user-supplied target passes `TargetGuardService`, which blocks
  loopback, private, link-local, CGNAT, multicast and reserved ranges (including on redirects
  and against DNS rebinding). Set `ALLOW_PRIVATE_TARGETS=true` only for local, single-user use.
- Timeouts, response size limits, port count limits and global rate limiting
  (`THROTTLE_LIMIT` requests/min) apply to all tools.
- The API has no authentication: keep it on localhost or behind an authenticating proxy.
  See [docs/security.md](docs/security.md).

## Architecture & agentic development

See **[AGENTS.md](AGENTS.md)** for the architecture, conventions, security rules and the
definition of done. `CLAUDE.md` files import it so Claude Code loads it automatically.

- `apps/api/AGENTS.md`: backend rules (plus NestJS ecosystem notes)
- `apps/web/AGENTS.md`: frontend structure and the cyberpunk design system
- `.claude/skills/add-recon-tool/`: step-by-step skill with templates for adding a new tool

To add a tool with an agent, ask e.g. _"Add a security.txt checker tool"_. The
`add-recon-tool` skill guides it through shared contract, API module, web feature and checks.
