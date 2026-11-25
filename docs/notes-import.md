# Notes import format

Other tools can hand their output to Recon Suite as **engagement notes**. They write JSON in
the format below. You either paste it into an engagement's **Notes** tab or send it to the
API. This page is the reference for anyone building such an integration.

- Format id: `recon-suite/notes`
- Current version: `1`
- Source of truth: `notesImportSchema` and `detectNotesImport()` in
  [`packages/shared/src/engagement.ts`](../packages/shared/src/engagement.ts)

## Example

```json
{
  "format": "recon-suite/notes",
  "version": 1,
  "notes": [
    {
      "title": "Admin panel reachable",
      "body": "GET /admin returns the login page without IP restriction.\nSeen from 203.0.113.7.",
      "target": "https://example.com/admin",
      "tags": ["web", "source:my-scanner"]
    },
    {
      "title": "Kickoff",
      "body": "Scope confirmed by IT."
    }
  ]
}
```

The smallest valid import:

```json
{ "format": "recon-suite/notes", "version": 1, "notes": [{ "title": "Hello" }] }
```

## Top-level object

| Field     | Type   | Required | Rules                                                                        |
| --------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `format`  | string | yes      | Exactly `"recon-suite/notes"`. This marker identifies the JSON as an import. |
| `version` | number | yes      | Exactly `1`. Any other value is rejected as unsupported.                     |
| `notes`   | array  | yes      | 1 to 200 note objects.                                                       |

## Note object

| Field    | Type     | Required | Default | Rules                                                                                                                                         |
| -------- | -------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`  | string   | yes      |         | Trimmed, 1 to 200 characters after trimming.                                                                                                  |
| `body`   | string   | no       | `""`    | Up to 50,000 characters. Plain text; line breaks (`\n`) are kept, Markdown is not rendered.                                                   |
| `target` | string   | no       | none    | Trimmed, up to 260 characters. Free text (host, IP, URL, ...); a host, IP or URL gets pivot links in the UI. An empty string means no target. |
| `tags`   | string[] | no       | `[]`    | Up to 20 tags. Each tag is trimmed and lowercased, then must be 1 to 40 characters of letters, digits, `_`, `-`, `:` or `.` (no spaces).      |

Notes:

- **Unknown fields are ignored**, at the top level and in notes. You can add your own metadata
  (e.g. `"generator": "my-scanner 2.1"`) without breaking the import, but it is not stored.
- **Tag ideas:** a `source:<tool>` tag (e.g. `source:nuclei`) makes imported notes easy to
  recognise and filter. Severity as a tag (`severity:high`) works the same way.
- **Encoding:** UTF-8 JSON. The whole request may be at most 2 MB.

## Behaviour

- **All or nothing:** if one note is invalid, no note is created. The error names the first
  problem with its path, e.g. `notes.1.title: Title is required` for an empty title (the UI prefixes it with `Invalid notes import:`).
- **Order:** notes are shown in the same order as in the `notes` array (the first note at the top).
- **No deduplication:** importing the same JSON twice creates every note twice. Notes are
  always added; existing notes are never updated or deleted.
- **Timestamps:** `createdAt` and `updatedAt` are set by Recon Suite at import time. They cannot
  be supplied.

## Importing in the UI

1. Open an engagement and switch to the **Notes** tab.
2. Copy the JSON to the clipboard and paste it (Ctrl/Cmd+V) anywhere on the tab, including in
   a text field.
3. The tab shows `Imported N notes`, or the validation error. Nothing is pasted into the field.

A paste only counts as an import if the text (ignoring surrounding whitespace) is a JSON object
whose `format` is `"recon-suite/notes"`. Anything else, including other JSON, pastes as normal
text. The Notes tab also shows this example, with a copy button, under **Format**.

## Importing through the API

`POST /api/engagements/:id/notes/import` with the JSON as body.

| Status | Meaning                                                             |
| ------ | ------------------------------------------------------------------- |
| 201    | Created; the body is the array of created notes, in import order    |
| 400    | Not a valid import (wrong `format` or `version`, invalid note, ...) |
| 403    | Cross-origin request from a browser page (CSRF protection)          |
| 404    | Unknown engagement                                                  |
| 413    | Request larger than 2 MB                                            |

```sh
API=http://localhost:4000/api
E=<engagement id>   # from GET $API/engagements

curl -s -X POST "$API/engagements/$E/notes/import" \
  -H 'content-type: application/json' \
  --data-binary @notes.json | jq 'length'
```

Each created note looks like this:

```json
{
  "id": "6f1c0e8a-...",
  "engagementId": "0b7d...",
  "title": "Admin panel reachable",
  "body": "GET /admin returns the login page without IP restriction.",
  "target": "https://example.com/admin",
  "tags": ["web", "source:my-scanner"],
  "createdAt": "2026-11-25T11:40:00.001Z",
  "updatedAt": "2026-11-25T11:40:00.001Z"
}
```

Scripts and command-line tools without a browser `Origin` header are accepted. The API has no
login (see [Security model](security.md)).

## Generating the format

Python:

```python
import json

notes = [
    {
        "title": f"Open port {p['port']}/tcp",
        "body": p["banner"],
        "target": host,
        "tags": ["ports", "source:my-scanner"],
    }
    for p in results
]
print(json.dumps({"format": "recon-suite/notes", "version": 1, "notes": notes[:200]}))
```

jq, turning an array of `{name, host, detail}` objects into an import:

```sh
jq '{format: "recon-suite/notes", version: 1,
     notes: [.[:200][] | {title: .name, target: .host, body: .detail,
                          tags: ["source:my-tool"]}]}' findings.json
```

Split larger result sets into several imports of at most 200 notes each.

## Versioning

`version` is raised only for changes that break existing producers or change what a field means.
New optional fields can be added within version 1; producers that don't send them keep working.
