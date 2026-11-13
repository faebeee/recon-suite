# HTTP API

The web UI is a client of a plain JSON API. You can call it directly from scripts.

- Base URL in development: `http://localhost:4000/api` (or `http://localhost:5173/api`
  through the Vite proxy)
- Base URL with containers: `http://localhost:8080/api` (through nginx) or
  `http://localhost:4000/api`
- Authentication: see [below](#authentication). Without a configured password the API only
  accepts requests from its own machine.

## Endpoints

| Method | Path                                                      | Purpose                                                                   |
| ------ | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/api/health`                                             | Health check (`status`, `service`, `version`, `timestamp`), public        |
| GET    | `/api/tools`                                              | Catalog: id, code, name, description, category, mode, scope of every tool |
| POST   | `/api/tools/<id>`                                         | Run a tool                                                                |
| GET    | `/api/tools/wifi/interfaces`                              | WiFi interfaces for the WiFi Scanner's `interface` option                 |
| GET    | `/api/tools/host-scan/interfaces`                         | Network interfaces for Host Scan's `interface` option                     |
| GET    | `/api/auth/status`                                        | `{ mode, authenticated }`, public                                         |
| POST   | `/api/auth/login`                                         | `{ password }`, sets the session cookie, public                           |
| POST   | `/api/auth/logout`                                        | Ends the session                                                          |
| ...    | `/api/engagements/...`, `/api/runs/...`, `/api/notes/...` | [Engagement workspace](#engagements)                                      |

Tool ids: `dns`, `subdomains`, `email-security`, `zone-transfer`, `dnssec`, `takeover`, `whois`,
`ip-intel`, `cve-lookup`, `cert-search`, `reverse-ip`, `cloud-storage`, `http-headers`, `tls`,
`web-files`, `tech-fingerprint`, `wayback`, `cors`, `tls-audit`, `js-endpoints`,
`exposed-files`, `ports`, `banner-grab`, `host-scan`, `wifi`, `bluetooth`. The options of each
tool are listed in the [Tools reference](tools.md).

`/api/health` and `/api/tools` are public and not rate limited. Everything else needs
authentication and is rate limited; `/api/auth/login` allows 10 attempts per minute.

## Running a tool

Send a JSON body. Remote tools need `target`; every other field is optional and has a default.
Local tools take `{}` or only their options.

```sh
curl -s -X POST http://localhost:4000/api/tools/dns \
  -H 'content-type: application/json' \
  -d '{"target":"example.com","types":["A","MX"],"resolver":"quad9"}'
```

Every tool responds with the same envelope:

```json
{
  "tool": "email-security",
  "target": "example.com",
  "startedAt": "2026-11-13T05:49:14.000Z",
  "durationMs": 142,
  "data": { "...": "tool-specific output" },
  "findings": [
    {
      "id": "dmarc.policy",
      "status": "warn",
      "title": "DMARC policy",
      "message": "..."
    }
  ],
  "runId": "only when the run was stored in an engagement"
}
```

- `target` is the normalised target (for local tools: the API host name).
- `findings` (pass, warn, fail, info) is present for tools that grade or flag something.
- The TypeScript types of every `data` payload live in `packages/shared/src/features/<id>.ts`.

## Errors

Errors use HTTP status codes and a JSON body with a human-readable `message`:

```json
{
  "message": "Target \"127.0.0.1\" resolves to a private or reserved address (127.0.0.1). Set ALLOW_PRIVATE_TARGETS=true to allow internal targets.",
  "error": "Forbidden",
  "statusCode": 403
}
```

| Status | Meaning                                                                                |
| ------ | -------------------------------------------------------------------------------------- |
| 400    | Invalid input; `message` is a list of field errors                                     |
| 401    | Not signed in (no valid session cookie or API token), or wrong password                |
| 403    | Target blocked (private/reserved address), out of engagement scope, cross-origin write |
| 404    | Domain does not exist (NXDOMAIN), nothing found, unknown engagement/run/note           |
| 409    | The engagement is archived                                                             |
| 413    | An upstream response exceeded the size limit                                           |
| 429    | Rate limit exceeded                                                                    |
| 502    | Upstream failure (target or third-party service refused, reset, errored, invalid key)  |
| 503    | Tool unavailable: local tool on the wrong host, or a required API key is not set       |
| 504    | Timeout                                                                                |

## Authentication

| Client  | How                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| Browser | `POST /api/auth/login` with `{ "password": "..." }` sets an HTTP-only session cookie (max 7 days, 12 h idle) |
| Scripts | `Authorization: Bearer <API_TOKEN>` on every request                                                         |
| Local   | Without `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH`, requests from the API's own machine (loopback) are let in  |

State-changing requests from other browser origins are rejected (CSRF protection). If the UI
runs on another origin than the API, list it in `CORS_ORIGIN`. See
[Configuration](configuration.md).

## Engagements

Send the header `x-engagement-id: <engagement id>` with a tool request to work inside an
engagement:

- **Active tools** only run when the target (and Subdomain Takeover's extra `hosts`) is in the
  engagement's scope; otherwise 403 `Out of scope for engagement "...": ...`. Passive tools are
  not restricted.
- The run is stored in the engagement's history, including upstream failures (502, 504, ...),
  and the response carries its `runId`. Invalid input, auth and rate-limit errors are not stored.
- Archived engagements answer 409.

| Method | Path                                    | Purpose                                                     |
| ------ | --------------------------------------- | ----------------------------------------------------------- |
| GET    | `/api/engagements`                      | List with counts                                            |
| POST   | `/api/engagements`                      | Create `{ name, client?, description? }`                    |
| GET    | `/api/engagements/:id`                  | One engagement                                              |
| PATCH  | `/api/engagements/:id`                  | Edit, or `{ "status": "archived" }` / `"active"`            |
| DELETE | `/api/engagements/:id`                  | Delete with its scope, runs and notes                       |
| GET    | `/api/engagements/:id/scope`            | Scope entries                                               |
| POST   | `/api/engagements/:id/scope`            | Add `{ entries: [{ value, excluded?, note? }] }`            |
| DELETE | `/api/engagements/:id/scope/:entryId`   | Remove an entry                                             |
| POST   | `/api/engagements/:id/scope/check`      | `{ target }` returns `{ inScope, reason }`                  |
| GET    | `/api/engagements/:id/runs`             | History; filters `tool`, `target`, `tag`, `limit`, `offset` |
| GET    | `/api/runs/:runId`                      | Stored request and full result                              |
| PATCH  | `/api/runs/:runId`                      | Set `{ tags }`                                              |
| DELETE | `/api/runs/:runId`                      | Delete a run                                                |
| GET    | `/api/runs/:before/diff/:after`         | What changed between two runs of the same tool              |
| GET    | `/api/engagements/:id/findings`         | Findings of the latest run per tool and target              |
| GET    | `/api/engagements/:id/notes`            | Notes                                                       |
| POST   | `/api/engagements/:id/notes`            | Add `{ title, body?, target?, tags? }`                      |
| PATCH  | `/api/notes/:noteId`                    | Edit a note                                                 |
| DELETE | `/api/notes/:noteId`                    | Delete a note                                               |
| GET    | `/api/engagements/:id/export?format=md` | Report download: `md`, `json` or `csv`                      |

Scope entries accept `example.com` (exact), `*.example.com` (subdomains, not the apex), an IP,
a CIDR range or a URL (its hostname is used). Exclusions win over inclusions. Domains are only
matched by domain rules and IPs by IP/CIDR rules: a domain is not in scope just because it
resolves into an in-scope range.

```sh
API=http://localhost:4000/api
AUTH="authorization: Bearer $API_TOKEN"
E=$(curl -s -X POST "$API/engagements" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"ACME Q4"}' | jq -r .id)
curl -s -X POST "$API/engagements/$E/scope" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"entries":[{"value":"example.com"},{"value":"*.example.com"}]}'
curl -s -X POST "$API/tools/http-headers" -H "$AUTH" -H "x-engagement-id: $E" \
  -H 'content-type: application/json' -d '{"target":"https://www.example.com"}' | jq .runId
curl -s "$API/engagements/$E/export?format=md" -H "$AUTH" -o report.md
```

## Examples

```sh
API=http://localhost:4000/api
# Add -H "authorization: Bearer $API_TOKEN" when a password is configured
post() { curl -s -X POST "$API/tools/$1" -H 'content-type: application/json' -d "$2"; }

# Mail spoofing protection, with an extra DKIM selector
post email-security '{"target":"example.com","dkimSelectors":["mail2024"]}'

# Zone transfer (zonetransfer.me allows AXFR on purpose)
post zone-transfer '{"target":"zonetransfer.me"}'

# Who hosts a domain? (all of its addresses)
post ip-intel '{"target":"example.com"}'

# robots.txt, sitemap and security.txt
post web-files '{"target":"https://example.com"}'

# Technology stack of a page, then known CVEs for a version (needs NVD_API_KEY)
post tech-fingerprint '{"target":"https://example.com"}'
post cve-lookup '{"target":"nginx 1.18.0"}'

# Accepted TLS versions and cipher suites
post tls-audit '{"target":"example.com"}'

# Web ports only, with a shorter timeout
post ports '{"target":"example.com","ports":[80,443,8080,8443],"timeoutMs":1000}'

# Local: Bluetooth LE for 12 seconds
post bluetooth '{"transport":"ble","durationSec":12}'
```

With `jq`, e.g. the failing findings of any tool:

```sh
post email-security '{"target":"example.com"}' \
  | jq '{grade: .data.report.grade, fails: [.findings[] | select(.status=="fail") | .title]}'
```
