# Configuration

All configuration is done with environment variables. Example files:

| File                    | Used by                                            |
| ----------------------- | -------------------------------------------------- |
| `apps/api/.env.example` | API in development (copy to `apps/api/.env`)       |
| `apps/web/.env.example` | Web app in development (copy to `apps/web/.env`)   |
| `.env.example`          | `podman compose` (copy to `.env` in the repo root) |

The API validates its environment at startup and refuses to start with invalid values. Empty
values count as "not set".

## API

| Variable                 | Default                 | Purpose                                                                                      |
| ------------------------ | ----------------------- | -------------------------------------------------------------------------------------------- |
| `PORT`                   | `4000`                  | HTTP port                                                                                    |
| `CORS_ORIGIN`            | `http://localhost:5173` | Allowed browser origins, comma separated (also trusted for cookie-authenticated writes)      |
| `ALLOW_PRIVATE_TARGETS`  | `false`                 | Allow loopback, private, link-local and reserved targets. Keep `false` when shared.          |
| `THROTTLE_LIMIT`         | `60`                    | Requests per minute per client across all tool endpoints                                     |
| `LOCAL_TOOLS_ENABLED`    | `true`                  | Enable WiFi, Bluetooth and Host Scan (they expose the server's surroundings)                 |
| `DATABASE_PATH`          | `data/recon.db`         | SQLite file for engagements, history, notes and sessions (relative to the working directory) |
| `ADMIN_PASSWORD_HASH`    | not set                 | scrypt hash of the login password (preferred), see below                                     |
| `ADMIN_PASSWORD`         | not set                 | Login password in plain text (min. 12 characters), hashed at startup                         |
| `API_TOKEN`              | not set                 | Bearer token for scripts (min. 32 characters)                                                |
| `COOKIE_SECURE`          | `true`                  | Secure session cookie. Set `false` only for plain HTTP on a host other than `localhost`      |
| `NVD_API_KEY`            | not set                 | Enables CVE Lookup ([free key](https://nvd.nist.gov/developers/request-an-api-key))          |
| `SECURITYTRAILS_API_KEY` | not set                 | Enables Reverse IP ([SecurityTrails](https://securitytrails.com))                            |

Booleans accept `true`, `false`, `1` and `0`.

### Login

Without `ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD`, the API only accepts requests from its own
machine (loopback), which suits `pnpm dev` on a laptop. As soon as the UI is reached any other
way (containers behind nginx, another computer), set a password:

```sh
pnpm --filter @recon/api hash-password   # asks for the password, prints the hash
```

Put the printed `$scrypt$...` value into `ADMIN_PASSWORD_HASH`. For scripts, generate a token
with e.g. `openssl rand -hex 32` and set `API_TOKEN`.

Browsers accept Secure cookies on `http://localhost`, so `COOKIE_SECURE=true` works for local
use and with HTTPS. Serving the UI over plain HTTP under another host name needs
`COOKIE_SECURE=false` (and is not recommended).

### Database

The SQLite file is created on first start, and schema migrations run automatically. Back it up
like any file (stop the API or copy it with `sqlite3 recon.db ".backup copy.db"`). Deleting it
removes all engagements and logs everyone out.

## Web

| Variable           | Default                 | Purpose                                                                                        |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------- |
| `API_PROXY_TARGET` | `http://localhost:4000` | Where the Vite dev server proxies `/api` (development only)                                    |
| `VITE_API_URL`     | `/api`                  | API base URL used by the browser; set it to call the API directly instead of through the proxy |

`VITE_API_URL` is baked in at build time. When you set it to another origin, add that origin
of the web app to the API's `CORS_ORIGIN`.

## Containers (`podman compose`)

| Variable                                | Default | Purpose                                                                    |
| --------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `API_PORT`                              | `4000`  | Host port for the API container                                            |
| `WEB_PORT`                              | `8080`  | Host port for the web container (nginx); also sets the API's `CORS_ORIGIN` |
| `ALLOW_PRIVATE_TARGETS`                 | `false` | Passed to the API                                                          |
| `THROTTLE_LIMIT`                        | `60`    | Passed to the API                                                          |
| `LOCAL_TOOLS_ENABLED`                   | `false` | Passed to the API. Off by default in containers                            |
| `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD` | not set | Passed to the API. **Required**: requests through nginx are not local      |
| `API_TOKEN`, `COOKIE_SECURE`            |         | Passed to the API                                                          |
| `NVD_API_KEY`, `SECURITYTRAILS_API_KEY` | not set | Passed to the API                                                          |

The Kali setup (`pnpm compose:up:kali`) adds `CONTAINER_SOCKET`, `CONTAINER_SOCKET_GID` and
`KALI_API_USER`; see [Kali container](local-tools.md#kali-container).

The web container serves the built UI and proxies `/api/` to the `api` service, so browsers
only need the web port. The API container has a health check on `/api/health`; the web
container starts once it reports healthy. The database lives in the named volume `recon-data`
(`/app/data` in the container) and survives rebuilds; `podman volume rm recon-suite_recon-data`
deletes it.

To run local tools from a container, see [Local tools setup](local-tools.md#containers).
