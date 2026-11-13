# Configuration

All configuration is done with environment variables. Example files:

| File                    | Used by                                            |
| ----------------------- | -------------------------------------------------- |
| `apps/api/.env.example` | API in development (copy to `apps/api/.env`)       |
| `apps/web/.env.example` | Web app in development (copy to `apps/web/.env`)   |
| `.env.example`          | `podman compose` (copy to `.env` in the repo root) |

The API validates its environment at startup and refuses to start with invalid values.

## API

| Variable                | Default                 | Purpose                                                                             |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `PORT`                  | `4000`                  | HTTP port                                                                           |
| `CORS_ORIGIN`           | `http://localhost:5173` | Allowed browser origins, comma separated                                            |
| `ALLOW_PRIVATE_TARGETS` | `false`                 | Allow loopback, private, link-local and reserved targets. Keep `false` when shared. |
| `THROTTLE_LIMIT`        | `60`                    | Requests per minute per client across all tool endpoints                            |
| `LOCAL_TOOLS_ENABLED`   | `true`                  | Enable WiFi, Bluetooth and Host Scan (they expose the server's surroundings)        |

Booleans accept `true`, `false`, `1` and `0`.

## Web

| Variable           | Default                 | Purpose                                                                                        |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------- |
| `API_PROXY_TARGET` | `http://localhost:4000` | Where the Vite dev server proxies `/api` (development only)                                    |
| `VITE_API_URL`     | `/api`                  | API base URL used by the browser; set it to call the API directly instead of through the proxy |

`VITE_API_URL` is baked in at build time. When you set it to another origin, add that origin
of the web app to the API's `CORS_ORIGIN`.

## Containers (`podman compose`)

| Variable                | Default | Purpose                                                                    |
| ----------------------- | ------- | -------------------------------------------------------------------------- |
| `API_PORT`              | `4000`  | Host port for the API container                                            |
| `WEB_PORT`              | `8080`  | Host port for the web container (nginx); also sets the API's `CORS_ORIGIN` |
| `ALLOW_PRIVATE_TARGETS` | `false` | Passed to the API                                                          |
| `THROTTLE_LIMIT`        | `60`    | Passed to the API                                                          |
| `LOCAL_TOOLS_ENABLED`   | `false` | Passed to the API. Off by default in containers                            |

The web container serves the built UI and proxies `/api/` to the `api` service, so browsers
only need the web port. The API container has a health check on `/api/health`; the web
container starts once it reports healthy.

To run local tools from a container, see [Local tools setup](local-tools.md#containers).
