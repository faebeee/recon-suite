# HTTP API

The web UI is a client of a plain JSON API. You can call it directly from scripts.

- Base URL in development: `http://localhost:4000/api` (or `http://localhost:5173/api`
  through the Vite proxy)
- Base URL with containers: `http://localhost:8080/api` (through nginx) or
  `http://localhost:4000/api`
- No authentication. Do not expose the API to untrusted networks; see
  [Security model](security.md).

## Endpoints

| Method | Path                              | Purpose                                                                   |
| ------ | --------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/api/health`                     | Health check (`status`, `service`, `version`, `timestamp`)                |
| GET    | `/api/tools`                      | Catalog: id, code, name, description, category, mode, scope of every tool |
| POST   | `/api/tools/<id>`                 | Run a tool                                                                |
| GET    | `/api/tools/wifi/interfaces`      | WiFi interfaces for the WiFi Scanner's `interface` option                 |
| GET    | `/api/tools/host-scan/interfaces` | Network interfaces for Host Scan's `interface` option                     |

Tool ids: `dns`, `subdomains`, `email-security`, `whois`, `ip-intel`, `http-headers`, `tls`,
`web-files`, `tech-fingerprint`, `ports`, `host-scan`, `wifi`, `bluetooth`. The options of each
tool are listed in the [Tools reference](tools.md).

`/api/health` and `/api/tools` are not rate limited; everything else is.

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
  "tool": "dns",
  "target": "example.com",
  "startedAt": "2026-11-13T05:49:14.000Z",
  "durationMs": 142,
  "data": { "...": "tool-specific output" }
}
```

`target` is the normalised target (for local tools: the API host name). The TypeScript types of
every `data` payload live in `packages/shared/src/features/<id>.ts`.

## Errors

Errors use HTTP status codes and a JSON body with a human-readable `message`:

```json
{
  "message": "Target \"127.0.0.1\" resolves to a private or reserved address (127.0.0.1). Set ALLOW_PRIVATE_TARGETS=true to allow internal targets.",
  "error": "Forbidden",
  "statusCode": 403
}
```

| Status | Meaning                                                                   |
| ------ | ------------------------------------------------------------------------- |
| 400    | Invalid input; `message` is a list of field errors                        |
| 403    | Target blocked (private or reserved address)                              |
| 404    | Domain does not exist (NXDOMAIN), or no record found                      |
| 413    | An upstream response exceeded the size limit                              |
| 429    | Rate limit exceeded                                                       |
| 502    | Upstream failure (target or third-party service refused, reset, errored)  |
| 503    | Local tool unavailable on this host (disabled, missing hardware/software) |
| 504    | Timeout                                                                   |

## Examples

```sh
API=http://localhost:4000/api
post() { curl -s -X POST "$API/tools/$1" -H 'content-type: application/json' -d "$2"; }

# Mail spoofing protection, with an extra DKIM selector
post email-security '{"target":"example.com","dkimSelectors":["mail2024"]}'

# Who hosts a domain? (all of its addresses)
post ip-intel '{"target":"example.com"}'

# robots.txt, sitemap and security.txt
post web-files '{"target":"https://example.com"}'

# Technology stack of a page
post tech-fingerprint '{"target":"https://example.com"}'

# Web ports only, with a shorter timeout
post ports '{"target":"example.com","ports":[80,443,8080,8443],"timeoutMs":1000}'

# Certificate on a mail port
post tls '{"target":"mail.example.com","port":993}'

# Local: Bluetooth LE for 12 seconds
post bluetooth '{"transport":"ble","durationSec":12}'
```

With `jq`, e.g. the email security grade and failing checks:

```sh
post email-security '{"target":"example.com"}' \
  | jq '.data.report | {grade, score, fails: [.findings[] | select(.status=="fail") | .title]}'
```
