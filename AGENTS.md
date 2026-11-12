# AGENTS.md

Instructions for coding agents (Claude Code, Codex, Cursor, ...) working on this repo.
Read this file fully before changing code. App-specific rules live in
`apps/api/AGENTS.md` and `apps/web/AGENTS.md`.

## What this is

**Recon Suite**: a collection of reconnaissance tools (DNS, RDAP/WHOIS, CT-log subdomains,
HTTP security headers, TLS, TCP ports) with a NestJS API and a cyberpunk-themed React UI.
It is meant for authorised security assessments of systems the operator owns or may test.

## Monorepo layout

```
apps/api          @recon/api     NestJS 12 (ESM), Vitest, oxlint
apps/web          @recon/web     Vite + React 19, TanStack Router/Query, Tailwind 4, shadcn/ui
packages/shared   @recon/shared  Zod schemas, types and tool catalog shared by both apps
```

pnpm workspaces + Turborepo. `@recon/shared` is compiled to `dist/` and must be built before the
apps typecheck (`turbo` does this automatically through `dependsOn: ["^build"]`).

## Commands (run from repo root)

| Task                       | Command                                            |
| -------------------------- | -------------------------------------------------- |
| Dev (api :4000, web :5173) | `pnpm dev`                                         |
| Build everything           | `pnpm build`                                       |
| Typecheck                  | `pnpm typecheck`                                   |
| Lint                       | `pnpm lint`                                        |
| Unit tests                 | `pnpm test`                                        |
| API e2e tests              | `pnpm --filter @recon/api test:e2e`                |
| Format                     | `pnpm format`                                      |
| Containers                 | `pnpm compose:up` / `pnpm compose:down`            |
| Add shadcn component       | `cd apps/web && pnpm dlx shadcn@latest add <name>` |

**Definition of done** for any change:
`pnpm format && pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @recon/api test:e2e`
all succeed. Report failures honestly; do not skip or weaken tests to make them pass.

## Architecture: feature-driven

Every tool is a **vertical slice** that uses the same id (kebab-case, e.g. `http-headers`) in
three places. Features never import from other features; shared code goes into the core layers.

```
packages/shared/src/
  common/            target schemas (domain/host/url/port), ToolMeta, ToolResult, health
  catalog.ts         TOOL_CATALOG: metadata of every tool (name, code, category, mode)
  io.ts              TOOL_INPUT_SCHEMAS + ToolIO type map (id -> input/output types)
  features/<id>.ts   Zod input schema, <X>Input / <X>Params / <X>Output types

apps/api/src/
  core/              cross-cutting infra (global CoreModule)
    net/             TargetGuardService: SSRF protection, blocked IP ranges
    http/            HttpClientService (guarded + trusted undici agents), readTextLimited
    util/            mapConcurrent
    tool-runner.ts   runTool(): wraps results in the ToolResult envelope
  config/env.ts      Zod-validated environment
  features/<id>/     <id>.module.ts, <id>.controller.ts, <id>.service.ts, pure helpers + *.spec.ts
  features/index.ts  FEATURE_MODULES registry

apps/web/src/
  components/ui/     shadcn primitives (generated, restyled via tokens)
  components/cyber/  design-system primitives: Panel, Tag, Meter, GlitchText, Segmented, ...
  components/tool/   tool scaffolding: ToolPage, TargetForm, FormOption, ToolResultView, PivotLinks
  components/layout/ AppShell, Sidebar, TopBar
  lib/               api-client, useToolRunner, tones, format, tool-search
  features/registry.ts  TOOL_UI: icon, tone, accepted target kinds per tool
  features/<id>/     <id>-tool.tsx (form + state), <id>-results.tsx (rendering), index.ts
  routes/tools/<id>.tsx thin file route: validateSearch + render the feature component
```

### API contract conventions

- Every tool is `POST /api/tools/<id>` with a JSON body validated by the shared Zod schema
  (`@Body({ schema })`, Nest's `StandardSchemaValidationPipe`, registered in `app.setup.ts`).
- Every tool responds with `ToolResult<Output>` built by `runTool(id, target, fn)`.
- The request field holding the target is always called `target`.
- Errors are Nest HTTP exceptions: 400 invalid input, 403 blocked target, 404 not found/NXDOMAIN,
  502 upstream failure, 504 timeout. The web `ApiError` shows `message` to the user, so write
  messages for humans.
- `GET /api/tools` returns the catalog, `GET /api/health` is the health check.

## Security rules (non-negotiable)

1. **Any connection to a user-supplied target must go through `TargetGuardService`.**
   - HTTP: use `HttpClientService.target()` (guarded lookup also covers redirects and DNS rebinding).
   - Raw sockets (net/tls): call `guard.resolve(host)` and connect to the returned IP, never to
     the raw hostname.
   - `HttpClientService.trusted()` is only for fixed third-party APIs (rdap.org, crt.sh) where
     the target is URL-encoded data, never the host.
2. Never weaken `blocked-ranges.ts` or default `ALLOW_PRIVATE_TARGETS` to true.
3. Bound everything: timeouts on every outbound call, response size limits (`readTextLimited`),
   capped list sizes in schemas (see `MAX_PORTS_PER_SCAN`), concurrency limits (`mapConcurrent`).
4. Keep tools at the level of a standard recon toolkit. Do not add exploitation, brute-forcing of
   credentials, DoS-style flooding, or evasion features.
5. Tools that connect to the target are `mode: 'active'` in the catalog; the UI then shows the
   authorisation notice automatically.
6. Rate limiting is global (`@nestjs/throttler`, `THROTTLE_LIMIT`). Only system endpoints use
   `@SkipThrottle()`.

## Adding a new tool

Use the project skill **`.claude/skills/add-recon-tool/SKILL.md`**: it has the full checklist
and code templates. In short:

1. `packages/shared`: add the id to `TOOL_IDS`, add metadata to `TOOL_CATALOG`, create
   `features/<id>.ts`, export it from `index.ts`, register it in `io.ts`.
2. `apps/api`: create `src/features/<id>/` (module, controller, service, spec), register the module
   in `src/features/index.ts`.
3. `apps/web`: add `TOOL_UI[<id>]` in `features/registry.ts`, create `src/features/<id>/`, add
   `src/routes/tools/<id>.tsx`.
4. Run the definition-of-done commands.

The TypeScript compiler enforces the registration: a new `ToolId` without catalog, `io.ts` or
`TOOL_UI` entries fails the typecheck.

Reference implementation to copy from: **`dns`** (simple) or **`http-headers`** (outbound HTTP,
pure analysis function with tests).

## Code conventions

- TypeScript strict everywhere. No `any`; use `unknown` and narrow it.
- API is ESM: relative imports end in `.js`. Web uses the `@/` alias and no extensions.
- Put parsing/analysis logic in pure functions next to the service (`*.parser.ts`, `*.mapper.ts`,
  `security-headers.ts`) and unit-test them without network access.
- Tests must not depend on the internet. Use fakes (see `http-headers.service.spec.ts`) or local
  servers (see `ports.service.spec.ts`).
- Prettier: single quotes, trailing commas, semicolons (root `.prettierrc`).
- Do not edit generated files: `apps/web/src/routeTree.gen.ts`, `pnpm-lock.yaml` (manually).
- Do not add dependencies when the platform or an existing dependency covers it. Check the
  first-party Nest packages listed in `apps/api/AGENTS.md` first.

## Environment

| Variable                | App | Default                 | Purpose                                 |
| ----------------------- | --- | ----------------------- | --------------------------------------- |
| `PORT`                  | api | `4000`                  | HTTP port                               |
| `CORS_ORIGIN`           | api | `http://localhost:5173` | Comma-separated allowed origins         |
| `ALLOW_PRIVATE_TARGETS` | api | `false`                 | Allow loopback/private/reserved targets |
| `THROTTLE_LIMIT`        | api | `60`                    | Requests per minute per client          |
| `API_PROXY_TARGET`      | web | `http://localhost:4000` | Vite dev proxy target for `/api`        |
| `VITE_API_URL`          | web | `/api`                  | API base URL used by the browser        |

Port 3000 is often taken by other local projects on dev machines; that is why the API uses 4000.
