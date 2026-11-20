# HTTP API

The web UI is a client of a plain JSON API. You can call it directly from scripts.

- Base URL in development: `http://localhost:4000/api` (or `http://localhost:5173/api`
  through the Vite proxy)
- Base URL with containers: `http://localhost:8090/api` (through the reverse proxy; the API
  container publishes no port of its own)
- No authentication: see [Access](#access).

## Endpoints

| Method | Path                                                      | Purpose                                                                    |
| ------ | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/api/health`                                             | Health check (`status`, `service`, `version`, `timestamp`)                 |
| GET    | `/api/tools`                                              | Catalog: id, code, name, description, category, mode, scope of every tool  |
| POST   | `/api/tools/<id>`                                         | Run a tool                                                                 |
| GET    | `/api/tools/wifi/interfaces`                              | WiFi interfaces for the WiFi Scanner's `interface` option                  |
| GET    | `/api/tools/host-scan/interfaces`                         | Network interfaces for Host Scan's `interface` option                      |
| GET    | `/api/system/runtime`                                     | Where and with what each tool runs                                         |
| GET    | `/api/system/overview`                                    | Status checks, database, tool support, settings (no secret values)         |
| GET    | `/api/system/host`                                        | OS, CPU, memory, interfaces (IP, MAC), gateway, DNS, internet check        |
| GET    | `/api/last-runs/<id>`                                     | `{ run }`: the tool's most recent run (`running`, `ok` or `error`) or null |
| ...    | `/api/engagements/...`, `/api/runs/...`, `/api/notes/...` | [Engagement workspace](#engagements)                                       |

Tool ids: `dns`, `subdomains`, `email-security`, `zone-transfer`, `dnssec`, `takeover`, `whois`,
`ip-intel`, `cve-lookup`, `cert-search`, `reverse-ip`, `cloud-storage`, `http-headers`, `tls`,
`web-files`, `tech-fingerprint`, `wayback`, `cors`, `tls-audit`, `js-endpoints`,
`exposed-files`, `ports`, `banner-grab`, `host-scan`, `wifi`, `bluetooth`. The options of each
tool are listed in the [Tools reference](tools.md).

There is no authentication and no rate limit.

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
  "message": "Could not resolve host \"does-not-exist.example\"",
  "error": "Not Found",
  "statusCode": 404
}
```

| Status | Meaning                                                                               |
| ------ | ------------------------------------------------------------------------------------- |
| 400    | Invalid input; `message` is a list of field errors                                    |
| 403    | Out of engagement scope, cross-origin write                                           |
| 404    | Domain/host does not exist (NXDOMAIN), nothing found, unknown engagement/run/note     |
| 409    | The engagement is archived                                                            |
| 413    | An upstream response exceeded the size limit                                          |
| 502    | Upstream failure (target or third-party service refused, reset, errored, invalid key) |
| 503    | Tool unavailable: local tool on the wrong host, or a required API key is not set      |
| 504    | Timeout                                                                               |

## Access

There is no login: every request that reaches the API is accepted. State-changing requests from other browser origins are rejected (CSRF protection). If the UI
runs on another origin than the API, list it in `CORS_ORIGIN`. See
[Configuration](configuration.md).

## Engagements

Send the header `x-engagement-id: <engagement id>` with a tool request to work inside an
engagement:

- **Active tools** only run when the target (and Subdomain Takeover's extra `hosts`) is in the
  engagement's scope; otherwise 403 `Out of scope for engagement "...": ...`. Passive tools are
  not restricted.
- The run is stored in the engagement's history, including upstream failures (502, 504, ...),
  and the response carries its `runId`. Invalid input errors are not stored.
- Archived engagements answer 409.

| Method | Path                                    | Purpose                                                                                         |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/api/engagements`                      | List with counts                                                                                |
| POST   | `/api/engagements`                      | Create `{ name, client?, description? }`                                                        |
| GET    | `/api/engagements/:id`                  | One engagement                                                                                  |
| PATCH  | `/api/engagements/:id`                  | Edit, or `{ "status": "archived" }` / `"active"`                                                |
| DELETE | `/api/engagements/:id`                  | Delete with its scope, runs and notes                                                           |
| GET    | `/api/engagements/:id/scope`            | Scope entries                                                                                   |
| POST   | `/api/engagements/:id/scope`            | Add `{ entries: [{ value, excluded?, note? }] }`                                                |
| DELETE | `/api/engagements/:id/scope/:entryId`   | Remove an entry                                                                                 |
| POST   | `/api/engagements/:id/scope/check`      | `{ target }` returns `{ inScope, reason }`                                                      |
| GET    | `/api/engagements/:id/runs`             | History; filters `tool`, `target`, `tag`, `limit`, `offset`                                     |
| GET    | `/api/runs/:runId`                      | Stored request and full result                                                                  |
| PATCH  | `/api/runs/:runId`                      | Set `{ tags }`                                                                                  |
| DELETE | `/api/runs/:runId`                      | Delete a run                                                                                    |
| GET    | `/api/runs/:before/diff/:after`         | What changed between two runs of the same tool                                                  |
| GET    | `/api/runs/:runId/changes`              | Readable changes against the previous successful run of the same tool and target (`RunChanges`) |
| GET    | `/api/engagements/:id/changes`          | `RunChanges` for the latest run of each tool and target (newest first, max 100)                 |
| GET    | `/api/engagements/:id/findings`         | Findings of the latest run per tool and target                                                  |
| GET    | `/api/engagements/:id/notes`            | Notes                                                                                           |
| POST   | `/api/engagements/:id/notes`            | Add `{ title, body?, target?, tags? }`                                                          |
| PATCH  | `/api/notes/:noteId`                    | Edit a note                                                                                     |
| DELETE | `/api/notes/:noteId`                    | Delete a note                                                                                   |
| GET    | `/api/engagements/:id/export?format=md` | Report download: `md`, `json` or `csv`                                                          |

Scope entries accept `example.com` (exact), `*.example.com` (subdomains, not the apex), an IP,
a CIDR range or a URL (its hostname is used). Exclusions win over inclusions. Domains are only
matched by domain rules and IPs by IP/CIDR rules: a domain is not in scope just because it
resolves into an in-scope range.

```sh
API=http://localhost:4000/api
E=$(curl -s -X POST "$API/engagements" -H 'content-type: application/json' \
  -d '{"name":"ACME Q4"}' | jq -r .id)
curl -s -X POST "$API/engagements/$E/scope" -H 'content-type: application/json' \
  -d '{"entries":[{"value":"example.com"},{"value":"*.example.com"}]}'
curl -s -X POST "$API/tools/http-headers" -H "x-engagement-id: $E" \
  -H 'content-type: application/json' -d '{"target":"https://www.example.com"}' | jq .runId
curl -s "$API/engagements/$E/export?format=md" -o report.md
```

## Examples

```sh
API=http://localhost:4000/api
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
