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

| Variable                 | Default                 | Purpose                                                                             |
| ------------------------ | ----------------------- | ----------------------------------------------------------------------------------- |
| `PORT`                   | `4000`                  | HTTP port                                                                           |
| `CORS_ORIGIN`            | `http://localhost:5173` | Allowed browser origins, comma separated (also trusted for state-changing requests) |
| `DATABASE_PATH`          | `data/recon.db`         | SQLite file for engagements, history and notes (relative to the working directory)  |
| `NVD_API_KEY`            | not set                 | Enables CVE Lookup ([free key](https://nvd.nist.gov/developers/request-an-api-key)) |
| `SECURITYTRAILS_API_KEY` | not set                 | Enables Reverse IP ([SecurityTrails](https://securitytrails.com))                   |

Booleans accept `true`, `false`, `1` and `0`.

### Access

There is no login. The API accepts every request that reaches it, so keep it on your own
machine: compose publishes the API and web ports on `127.0.0.1` only.

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
| `WEB_PORT`                              | `8090`  | Host port for the web container (nginx); also sets the API's `CORS_ORIGIN` |
| `NVD_API_KEY`, `SECURITYTRAILS_API_KEY` | not set | Passed to the API                                                          |

The API image is built on Kali and runs nmap itself; see [Containers](local-tools.md#containers).

The web container serves the built UI and proxies `/api/` to the `api` service, so browsers
only need the web port. The API container has a health check on `/api/health`; the web
container starts once it reports healthy. The database lives in the named volume `recon-data`
(`/app/data` in the container) and survives rebuilds; `podman volume rm recon-suite_recon-data`
deletes it.

To run local tools from a container, see [Local tools setup](local-tools.md#containers).
