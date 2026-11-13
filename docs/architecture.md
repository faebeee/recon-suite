# Architecture

This page is an overview. The binding rules for contributors and coding agents (conventions,
security rules, definition of done) are in [`AGENTS.md`](../AGENTS.md),
[`apps/api/AGENTS.md`](../apps/api/AGENTS.md) and [`apps/web/AGENTS.md`](../apps/web/AGENTS.md).

## Monorepo

pnpm workspaces and Turborepo:

| Path              | Package         | Stack                                                                                                     |
| ----------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/api`        | `@recon/api`    | NestJS 12 (ESM), Zod validation, undici, throttler, @nestjs/authentication, Drizzle + node:sqlite, Vitest |
| `apps/web`        | `@recon/web`    | Vite, React 19, TanStack Router + Query, Tailwind 4, shadcn/ui                                            |
| `packages/shared` | `@recon/shared` | Zod schemas, types and the tool catalog used by both apps                                                 |

`@recon/shared` is compiled to `dist/` and built before the apps (Turborepo handles the order).

## Feature slices

Each tool is a vertical slice that uses one kebab-case id (e.g. `web-files`) in three places:

```
packages/shared/src/features/web-files.ts   input schema (Zod) + output types
apps/api/src/features/web-files/            Nest module, controller, service, pure parsers + specs
apps/web/src/features/web-files/            form component + results component
apps/web/src/routes/tools/web-files.tsx     thin route file
```

The id is also registered in the shared catalog (`TOOL_CATALOG`: name, code, category, mode),
the shared I/O map (`io.ts`), the API module list and the web UI registry (`TOOL_UI`: icon,
colour tone, accepted target kinds). TypeScript fails the build when one of these is missing.

Features never import from each other. Shared code lives in core layers:

| Layer                        | Contents                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/common` | Target schemas (domain, host, URL, port), tool metadata, result envelope, graded findings                                                                                             |
| `apps/api/src/core`          | Target guard, guarded and trusted HTTP clients, size-limited readers, `runCommand`, `mapConcurrent`, `runTool`, `db/` (Drizzle schema + SQLite), `auth/` (login, sessions, API token) |
| `apps/web/src/components`    | Design-system primitives (`cyber/`), tool page scaffolding (`tool/`), layout, shadcn/ui                                                                                               |
| `apps/web/src/lib`           | API client, `useToolRunner`, tones, theme, formatting                                                                                                                                 |

## Request flow

```
Browser                         API                                      Outside world
-------                         ---                                      -------------
Tool form
  | useToolRunner: validate
  |   with the shared schema
  v
POST /api/tools/<id>  ------>   throttler (rate limit)
  (+ x-engagement-id)           authentication guard (session cookie / API token / local)
                                RunCaptureInterceptor (engagement: scope check, then record)
                                StandardSchemaValidationPipe (same schema)
                                <Id>Controller
                                  runTool(id, target, fn, { findings })  -- ToolResult
                                    <Id>Service
                                      |-- passive: trusted client / DNS  --> resolvers, RDAP, crt.sh
                                      '-- active:  TargetGuard + guarded --> the target
                                                   HTTP client / socket
ToolResultView  <-----------    { tool, target, startedAt, durationMs, data, findings?, runId? }
  results component
  + pivot links to other tools
```

The same Zod schema validates input in the browser (instant feedback) and in the API (the only
check that counts).

## Engagements, history and authentication

These are not tools, so they live outside the tool slices:

| Piece                | Where                                                                                        | What it does                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Database             | `apps/api/src/core/db/`, `apps/api/drizzle/`                                                 | Drizzle schema on Node's built-in `node:sqlite`; migrations run at startup                                   |
| Authentication       | `apps/api/src/core/auth/`                                                                    | `@nestjs/authentication` global guard; session cookie, API token, local-open providers; SQLite session store |
| Engagement workspace | `apps/api/src/features/engagements/`                                                         | REST endpoints, pure `scope.ts`, `diff.ts`, `export.ts`                                                      |
| Run capture          | `run-capture.interceptor.ts`                                                                 | Global interceptor on `POST /api/tools/<id>`: scope check for active tools, stores the run and its findings  |
| Contract             | `packages/shared/src/engagement.ts`                                                          | Types, schemas, endpoint map (`ENGAGEMENT_API`), header name                                                 |
| UI                   | `apps/web/src/features/{engagements,batch,auth}/`, `lib/engagement*.ts`, `lib/api-client.ts` | Pages, active engagement store, header injection, login gate                                                 |

Because the interceptor wraps every tool endpoint, a new tool is recorded and scope-checked
without extra code. To feed the findings export it only has to pass a `findings` extractor to
`runTool()`.

Schema changes: edit `src/core/db/schema.ts`, then `pnpm --filter @recon/api db:generate
--name=<change>` and commit the generated folder under `apps/api/drizzle/`.

## Design system and themes

The UI uses semantic tones (`cyan` info, `green` pass, `yellow` warning, `magenta` error)
instead of raw colours, and a small set of primitives (`Panel`, `Tag`, `Meter`,
`KeyValueGrid`, ...). Themes only override CSS tokens and a few component hooks
(`src/themes/<id>.css`), so features never need to know which theme is active. Details in
[`apps/web/AGENTS.md`](../apps/web/AGENTS.md).

## Adding a tool

Follow the project skill [`.claude/skills/add-recon-tool/SKILL.md`](../.claude/skills/add-recon-tool/SKILL.md).
It has the full checklist and code templates; coding agents pick it up automatically when you
ask for a new tool. Good references to copy from: `dns` (simple), `http-headers` (outbound
HTTP with a pure analysis function), `web-files` (several guarded requests, per-file errors).

Before a change is done, all of these must pass:

```sh
pnpm format && pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @recon/api test:e2e
```
