# Configuration

All configuration is done with environment variables. Example files:

| File                    | Used by                           |
| ----------------------- | --------------------------------- |
| `apps/api/.env.example` | API (copy to `apps/api/.env`)     |
| `apps/web/.env.example` | Web app (copy to `apps/web/.env`) |

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

There is no login. The API accepts every request that reaches it and listens on every interface
(`0.0.0.0`). Only run it on networks where everyone may use it.

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

## Start script (`npm start`)

`scripts/start.sh` builds everything, then runs the API and `vite preview` on this machine.

| Variable         | Default   | Purpose                                                                                                                                       |
| ---------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_PORT`       | `4000`    | API port (passed as `PORT`)                                                                                                                   |
| `WEB_PORT`       | `4173`    | Port of the web app; also sets the API's `CORS_ORIGIN`                                                                                        |
| `BIND_ADDRESS`   | `0.0.0.0` | Interface the web app listens on; `127.0.0.1` keeps it on this machine                                                                        |
| `PUBLIC_ORIGINS` | not set   | Comma-separated URLs used from other devices (e.g. `http://192.168.1.20:4173`); added to `CORS_ORIGIN`, otherwise the CSRF check rejects them |
