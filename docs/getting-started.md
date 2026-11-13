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

At startup the API logs which tools this machine can run and, for the ones it can't, why and
how to fix it (missing `arp-scan`, missing permission, running in a container, ...).

## Your first scan

1. Open http://localhost:5173 and pick **DNS Recon** in the sidebar.
2. Enter a domain, e.g. `example.com`, and press **Execute**.
3. Hostnames in the results have small icons next to them: these are pivots that open the
   same value in another tool (WHOIS, TLS, IP Intel, ...).

The dashboard's quick-target field does the same in reverse: type a domain, IP or URL and it
lists every tool that accepts it.

## Run with containers

```sh
cp .env.example .env        # optional, adjust ports and flags
pnpm compose:up             # builds and starts api + web
pnpm compose:logs
pnpm compose:down
```

The web container (nginx) serves the UI on http://localhost:8080 and proxies `/api` to the API
container. Local tools are disabled in containers by default; see
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

| Symptom                                             | Cause and fix                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `403 ... resolves to a private or reserved address` | The target is internal. Intended; set `ALLOW_PRIVATE_TARGETS=true` only for local, single-user use. |
| `429 Too Many Requests`                             | Rate limit reached (`THROTTLE_LIMIT` per minute). Wait a minute or raise the limit.                 |
| `503` on WiFi, Bluetooth or Host Scan               | Local tools are disabled or the host lacks the hardware/software. See the API startup log.          |
| Top bar shows `uplink down`                         | API not running, or `API_PROXY_TARGET` points to the wrong port.                                    |
| `EADDRINUSE` on 4000 or 5173                        | Another process uses the port. Change `PORT` / `API_PROXY_TARGET` or stop the other process.        |
