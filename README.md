# Recon Suite

A collection of reconnaissance tools with a cyberpunk HUD interface. Built as a
Turborepo monorepo with a feature-driven architecture.

> For authorised security assessments only. Active modules connect directly to the
> target; only probe systems you own or have permission to test.

## Tools

| Code | Tool             | Mode    | What it does                                                             |
| ---- | ---------------- | ------- | ------------------------------------------------------------------------ |
| D-01 | DNS Recon        | passive | A, AAAA, CNAME, MX, NS, TXT, SOA, CAA via Cloudflare/Google/Quad9/system |
| D-02 | Subdomain Finder | passive | Subdomains from certificate transparency logs (crt.sh)                   |
| I-01 | WHOIS / RDAP     | passive | Registrar, lifecycle, status, nameservers; IP network ownership          |
| W-01 | HTTP Inspector   | active  | Redirect chain, headers, security-header grade, disclosures              |
| W-02 | TLS Inspector    | active  | Protocol, cipher, certificate, SANs, chain, expiry                       |
| N-01 | Port Probe       | active  | TCP connect check on preset or custom ports (max 64)                     |

Results link to each other ("pivots"): a hostname found in DNS, CT logs or a certificate
can be opened in any other compatible tool with one click. Every tool also accepts
`?target=` in the URL, e.g. `/tools/dns?target=example.com`.

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

## Security model

- Every connection to a user-supplied target passes `TargetGuardService`, which blocks
  loopback, private, link-local, CGNAT, multicast and reserved ranges (including on redirects
  and against DNS rebinding). Set `ALLOW_PRIVATE_TARGETS=true` only for local, single-user use.
- Timeouts, response size limits, port count limits and global rate limiting
  (`THROTTLE_LIMIT` requests/min) apply to all tools.

## Architecture & agentic development

See **[AGENTS.md](AGENTS.md)** for the architecture, conventions, security rules and the
definition of done. `CLAUDE.md` files import it so Claude Code loads it automatically.

- `apps/api/AGENTS.md`: backend rules (plus NestJS ecosystem notes)
- `apps/web/AGENTS.md`: frontend structure and the cyberpunk design system
- `.claude/skills/add-recon-tool/`: step-by-step skill with templates for adding a new tool

To add a tool with an agent, ask e.g. _"Add a security.txt checker tool"_. The
`add-recon-tool` skill guides it through shared contract, API module, web feature and checks.
