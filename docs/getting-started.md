# Getting started

## Requirements

- Node.js 24 or newer
- pnpm 11 (`corepack enable` picks up the version pinned in `package.json`)
- Podman with `podman compose`, only for the container setup
- Optional, for local tools: see [Local tools setup](local-tools.md)

## Run in development

```sh
pnpm install
pnpm dev
```

| Service | URL                       |
| ------- | ------------------------- |
| Web UI  | http://localhost:5173     |
| API     | http://localhost:4000/api |

The Vite dev server proxies `/api` to the API, so the browser only talks to port 5173.
Port 4000 is used for the API because 3000 is often taken by other local projects.

Without a password the API accepts requests from this machine only, so locally there is no
login. Set `ADMIN_PASSWORD` in `apps/api/.env` to require one (see
[Configuration](configuration.md#login)). Engagements and history are stored in
`apps/api/data/recon.db`, created on first start.

At startup the API logs which tools this machine can run and, for the ones it can't, why and
how to fix it (missing `nmap`, missing permission, running in a container, ...).

## Your first scan

1. Optional: open **Engagements**, create one and add your scope (e.g. `example.com` and
   `*.example.com`). Runs are then saved and active tools stay inside the scope.
2. Open http://localhost:5173 and pick **DNS Recon** in the sidebar.
3. Enter a domain, e.g. `example.com`, and press **Execute**.
4. Hostnames in the results have small icons next to them: these are pivots that open the
   same value in another tool (WHOIS, TLS, IP Intel, ...).

The dashboard's quick-target field does the same in reverse: type a domain, IP or URL and it
lists every tool that accepts it.

## Run with containers

Containers need a password, because requests arrive through nginx and are not local:

```sh
cp .env.example .env
pnpm --filter @recon/api hash-password   # put the result into ADMIN_PASSWORD_HASH in .env
pnpm compose:up             # builds and starts api + web
pnpm compose:logs
pnpm compose:down
```

The web container (nginx) serves the UI on http://localhost:8080 and proxies `/api` to the API
container. The database is kept in the `recon-data` volume. Local tools are disabled in containers by default; see
[Local tools setup](local-tools.md#containers).

## Everyday commands

| Task                 | Command                             |
| -------------------- | ----------------------------------- |
| Build everything     | `pnpm build`                        |
| Typecheck            | `pnpm typecheck`                    |
| Lint                 | `pnpm lint`                         |
| Unit tests           | `pnpm test`                         |
| API end-to-end tests | `pnpm --filter @recon/api test:e2e` |
| Format               | `pnpm format`                       |
| macOS helper (once)  | `pnpm setup:macos-helper`           |

Tests never touch the internet: network code is tested with fakes and local servers.

## Troubleshooting

| Symptom                                             | Cause and fix                                                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `403 ... resolves to a private or reserved address` | The target is internal. Intended; set `ALLOW_PRIVATE_TARGETS=true` only for local, single-user use.        |
| `429 Too Many Requests`                             | Rate limit reached (`THROTTLE_LIMIT` per minute). Wait a minute or raise the limit.                        |
| `503` on WiFi, Bluetooth or Host Scan               | Local tools are disabled or the host lacks the hardware/software. See the API startup log.                 |
| Top bar shows `uplink down`                         | API not running, or `API_PROXY_TARGET` points to the wrong port.                                           |
| `EADDRINUSE` on 4000 or 5173                        | Another process uses the port. Change `PORT` / `API_PROXY_TARGET` or stop the other process.               |
| `503` on CVE Lookup or Reverse IP                   | `NVD_API_KEY` / `SECURITYTRAILS_API_KEY` not set.                                                          |
| `403 Out of scope for engagement ...`               | The active engagement's scope does not cover the target. Add it in the Scope tab, or pick "No engagement". |
| UI says it only works on the API's machine          | No password configured and you are not on localhost. Set `ADMIN_PASSWORD_HASH`.                            |
| Logged out right after login                        | UI served over plain HTTP on a host other than localhost: use HTTPS or set `COOKIE_SECURE=false`.          |
