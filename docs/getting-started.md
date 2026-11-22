# Getting started

## Requirements

- Node.js 24 or newer (`.nvmrc`: `nvm install && nvm use`). Distribution packages such as
  `apt install nodejs` on Debian, Kali or Parrot are usually too old; the API needs the built-in
  `node:sqlite` module.
- npm 11 (ships with Node.js)
- Optional: `nmap` for Nmap Scan, Network Scan and Host Scan, `gobuster` (plus wordlists such as
  `seclists`) for Gobuster
- Optional, for local tools: see [Local tools setup](local-tools.md)

## Run in development

```sh
npm install
npm run dev
```

| Service | URL                       |
| ------- | ------------------------- |
| Web UI  | http://localhost:5173     |
| API     | http://localhost:4000/api |

The Vite dev server proxies `/api` to the API, so the browser only talks to port 5173.
Port 4000 is used for the API because 3000 is often taken by other local projects.
Other ports: `API_PORT=4100 WEB_PORT=5200 npm run dev` (see [Configuration](configuration.md#ports-api_port-web_port)).

There is no login. Engagements and history are stored in
`apps/api/data/recon.db`, created on first start.

At startup the API logs which tools this machine can run and, for the ones it can't, why and
how to fix it (missing `nmap` or `gobuster`, missing permission, ...).

## Your first scan

1. Optional: open **Engagements** and create one. Runs are then saved to its history.
2. Open http://localhost:5173 and pick **DNS Recon** in the sidebar.
3. Enter a domain, e.g. `example.com`, and press **Execute**.
4. Hostnames in the results have small icons next to them: these are pivots that open the
   same value in another tool (WHOIS, TLS, IP Intel, ...).

The dashboard's quick-target field does the same in reverse: type a domain, IP or URL and it
lists every tool that accepts it.

## Run a build

`npm start` builds everything, then runs the API and the web app in the background on this
machine; `npm stop` ends both. PIDs and logs go to `.run/`.

```sh
npm start   # npm run build, then api :4000 and web :4173 (vite preview, proxies /api)
npm stop
```

| Service | URL                       |
| ------- | ------------------------- |
| Web UI  | http://localhost:4173     |
| API     | http://localhost:4000/api |

`API_PORT` and `WEB_PORT` change the ports. The web app listens on `BIND_ADDRESS` (default
`0.0.0.0`, the LAN; `127.0.0.1` keeps it on this machine) and the API on every interface. There is
no login, so only run it on a trusted network. The UI works from any address of this machine (e.g.
`http://192.168.1.20:4173`): the web app forwards `/api` with the original `Host`, so the CSRF
check sees a same-origin request. A hostname such as `raspberrypi.local` must be added to
`preview.allowedHosts` / `server.allowedHosts` in `apps/web/vite.config.ts` (IPs and `localhost`
are always allowed).

## Everyday commands

| Task                 | Command                          |
| -------------------- | -------------------------------- |
| Build everything     | `npm run build`                  |
| Typecheck            | `npm run typecheck`              |
| Lint                 | `npm run lint`                   |
| Unit tests           | `npm test`                       |
| API end-to-end tests | `npm run test:e2e -w @recon/api` |
| Format               | `npm run format`                 |
| macOS helper (once)  | `npm run setup:macos-helper`     |

Tests never touch the internet: network code is tested with fakes and local servers.

## Troubleshooting

| Symptom                                | Cause and fix                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `503` on WiFi, Bluetooth or Host Scan  | Local tools are disabled or the host lacks the hardware/software. See the API startup log.                 |
| Top bar shows `uplink down`            | API not running, or `API_PROXY_TARGET` points to the wrong port.                                           |
| `EADDRINUSE` on 4000 or 5173           | Another process uses the port. Change `PORT` / `API_PROXY_TARGET` or stop the other process.               |
| `No such built-in module: node:sqlite` | Node.js is older than 24. Install a current version (`nvm install`), then `rm -rf node_modules && npm ci`. |
| `503` on CVE Lookup or Reverse IP      | `NVD_API_KEY` / `SECURITYTRAILS_API_KEY` not set.                                                          |
