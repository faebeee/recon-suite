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
scripts          start.sh / stop.sh: build, then run api + web on the host (`npm start` / `npm stop`)
```

npm workspaces + Turborepo. `@recon/shared` is compiled to `dist/` and must be built before the
apps typecheck (`turbo` does this automatically through `dependsOn: ["^build"]`).

## Commands (run from repo root)

| Task                              | Command                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Dev (api :4000, web :5173)        | `npm run dev`                                                                                |
| Native run (api :4000, web :4173) | `npm start` / `npm stop` (builds first; pids + logs in `.run/`)                              |
| Build everything                  | `npm run build`                                                                              |
| Typecheck                         | `npm run typecheck`                                                                          |
| Lint                              | `npm run lint`                                                                               |
| Unit tests                        | `npm test`                                                                                   |
| API e2e tests                     | `npm run test:e2e -w @recon/api`                                                             |
| Format                            | `npm run format`                                                                             |
| Add shadcn component              | `cd apps/web && npx shadcn@latest add <name>`                                                |
| macOS helper (once)               | `npm run setup:macos-helper` (builds `apps/api/native/macos`, asks for Location + Bluetooth) |

**Definition of done** for any change:
`npm run format && npm run build && npm run typecheck && npm run lint && npm test && npm run test:e2e -w @recon/api`
all succeed. Report failures honestly; do not skip or weaken tests to make them pass.

## Architecture: feature-driven

Every tool is a **vertical slice** that uses the same id (kebab-case, e.g. `http-headers`) in
three places. Features never import from other features; shared code goes into the core layers.

```
packages/shared/src/
  common/            target schemas (domain/host/url/port), ToolMeta, ToolResult, Finding/grading, health
  engagement.ts      engagement/scope/run/note contract + ENGAGEMENT_API endpoint map
  catalog.ts         TOOL_CATALOG: metadata of every tool (name, code, category, mode)
  io.ts              TOOL_INPUT_SCHEMAS + ToolIO type map (id -> input/output types)
  features/<id>.ts   Zod input schema, <X>Input / <X>Params / <X>Output types

apps/api/src/
  core/              cross-cutting infra (global CoreModule)
    net/             TargetGuardService: resolves targets (no private-range block)
    http/            HttpClientService (guarded + trusted undici agents), readTextLimited
    process/         runCommand(): fixed OS commands via execFile (local tools)
                     ToolExecService: nmap on the API host
    util/            mapConcurrent
    db/              Drizzle schema (schema.ts) on node:sqlite; migrations in apps/api/drizzle/
    tool-runner.ts   runTool(id, target, fn, { findings }): ToolResult envelope (+ findings)
  config/env.ts      Zod-validated environment
  features/<id>/     <id>.module.ts, <id>.controller.ts, <id>.service.ts, pure helpers + *.spec.ts
  features/engagements/  engagement workspace + RunCaptureInterceptor (scope check, run history)
  features/last-runs/    LastRunInterceptor: stores each tool's most recent run (tool_last_runs)
  features/index.ts  FEATURE_MODULES registry

apps/web/src/
  components/ui/     shadcn primitives (generated, restyled via tokens)
  components/cyber/  design-system primitives: Panel, Tag, Meter, GlitchText, Segmented, ...
  components/tool/   tool scaffolding: ToolPage, TargetForm, FormOption, ToolResultView, PivotLinks
  components/layout/ AppShell, Sidebar, TopBar
  lib/               api-client, useToolRunner, tones, format, tool-search
  features/registry.ts  TOOL_UI: icon, tone, accepted target kinds per tool
  features/<id>/     <id>-tool.tsx (form + state), <id>-results.tsx (rendering), index.ts
  features/{engagements,batch}/  workspace pages, batch runner
  routes/tools/<id>.tsx thin file route: validateSearch + render the feature component
```

### API contract conventions

- Every tool is `POST /api/tools/<id>` with a JSON body validated by the shared Zod schema
  (`@Body({ schema })`, Nest's `StandardSchemaValidationPipe`, registered in `app.setup.ts`).
- Every tool responds with `ToolResult<Output>` built by `runTool(id, target, fn, { findings })`.
  Tools that grade or flag something pass a `findings` extractor (`Finding[]`, pass/warn/fail/info):
  that is what engagements collect and export. Prefer a `findings` field in the output type.
- Engagements are generic: `RunCaptureInterceptor` wraps every `POST /api/tools/<id>`. With the
  `x-engagement-id` header it enforces the scope for `mode: 'active'` tools (the `target` and a
  `hosts` array) and stores the run. New tools need no engagement code.
- `LastRunInterceptor` (registered before the engagement one) stores every tool request as that
  tool's last run (`running`, then `ok`/`error`); `useToolRunner` shows it when a tool page opens
  and polls while it is running. Shared helpers for tool requests live in `core/tool-request.ts`.
- The request field holding the target is always called `target`.
- **Local tools** (`scope: 'local'`, e.g. `wifi`) have no target: their input schema is
  `z.object({})` (or options only), `runTool` gets `os.hostname()` as target, `TOOL_UI.accepts`
  is `[]`, and the web page uses a scan panel instead of `TargetForm`. They only work when the
  API runs natively on a machine with the needed hardware (answer 503 with a helpful message
  when unavailable). They are always enabled.
- Errors are Nest HTTP exceptions: 400 invalid input, 403 out of scope, 404 not found/NXDOMAIN,
  502 upstream failure, 504 timeout. The web `ApiError` shows `message` to the user, so write
  messages for humans.
- `GET /api/tools` returns the catalog, `GET /api/health` is the health check.
- There is **no authentication**: every route is open to whoever can reach the API. Access
  control is the network: the app runs on the host only; the API listens on every interface
  and `npm start` serves the UI on `BIND_ADDRESS` (default `0.0.0.0`, i.e. the LAN). CSRF protection
  (`app.enableCsrfProtection`, trusted origins = `CORS_ORIGIN`) stops other web pages in the
  operator's browser from calling the API; keep it.
- Tools may expose helper sub-resources for their UI as `GET /api/tools/<id>/<name>` (plain
  response, no `ToolResult` envelope), e.g. `GET /api/tools/wifi/interfaces` for the dropdown.
  Put the path constant in the shared feature file (`WIFI_INTERFACES_ENDPOINT`).

## Security rules (non-negotiable)

1. **Any connection to a user-supplied target must go through `TargetGuardService`.**
   It resolves the target; private, loopback and reserved addresses are allowed (no block).
   - HTTP: use `HttpClientService.target()` (guarded lookup also covers redirects and DNS rebinding).
   - Raw sockets (net/tls): call `guard.resolve(host)` and connect to the returned IP, never to
     the raw hostname.
   - `HttpClientService.trusted()` is only for fixed third-party APIs (rdap.org, crt.sh) where
     the target is URL-encoded data, never the host.
2. Internal targets are always reachable, so the network binding (rule 6) is the only thing
   keeping the API from being an SSRF proxy. Do not loosen it.
3. Bound everything: timeouts on every outbound call, response size limits (`readTextLimited`),
   capped list sizes in schemas (see `MAX_PORTS_PER_SCAN`), concurrency limits (`mapConcurrent`).
   Exception: nmap scans (Nmap Scan, Network Scan, Host Scan sweep) run without a time limit
   (`ToolExecService.run(..., { timeoutMs: null })`) and without a cap on parallel scans.
4. Keep tools at the level of a standard recon toolkit. Do not add exploitation, brute-forcing of
   credentials, DoS-style flooding, or evasion features.
5. Tools that connect to the target are `mode: 'active'` in the catalog; the UI then shows the
   authorisation notice automatically.
6. There is no rate limit and no login. The app runs on the host (no containers): the UI from
   `npm start` listens on `BIND_ADDRESS` (default `0.0.0.0`: every device on the network can use
   the app; the operator chose LAN access, so keep that default) and the API on every interface.
   Keep CSRF protection on and keep `changeOrigin: false` on the Vite `/api` proxy (the UI is
   same-origin from any address); never set Vite's `allowedHosts: true` (DNS rebinding) and never
   add a wildcard origin. Extra origins go into `PUBLIC_ORIGINS`.
7. OS commands only through `runCommand()` (or `ToolExecService.run()` for the closed
   closed `EXEC_COMMANDS` list) with a hard-coded command and
   argument array.
   Never build commands from user input and never use a shell. A user-chosen value may only
   become an argument after strict schema validation **and** an allowlist check against what the
   OS reported (see `WifiService.scan`: the interface must be in `listInterfaces()`).
8. Never trust `X-Forwarded-For` or other client-supplied headers for security decisions.
9. Database changes only through the Drizzle schema plus a generated migration
   (`npm run db:generate -w @recon/api -- --name=<change>`); never edit applied migrations.
10. Local tools expose the server's surroundings (e.g. nearby WiFi networks reveal its location)
    and can't be turned off: one more reason to only run it on trusted networks (rule 6).

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
- Do not edit generated files: `apps/web/src/routeTree.gen.ts`, `package-lock.json` (manually).
- Do not add dependencies when the platform or an existing dependency covers it. Check the
  first-party Nest packages listed in `apps/api/AGENTS.md` first.

## Environment

| Variable                 | App  | Default                 | Purpose                                                                                |
| ------------------------ | ---- | ----------------------- | -------------------------------------------------------------------------------------- |
| `API_PORT`               | both | `4000`                  | API port for `npm run dev` / `npm start` (wins over `PORT`, sets the web proxy target) |
| `WEB_PORT`               | both | `5173` / `4173`         | Web port for `npm run dev` / `npm start` (added to `CORS_ORIGIN`)                      |
| `PORT`                   | api  | `4000`                  | HTTP port                                                                              |
| `CORS_ORIGIN`            | api  | `http://localhost:5173` | Comma-separated allowed origins                                                        |
| `DATABASE_PATH`          | api  | `data/recon.db`         | SQLite file (`:memory:` in e2e tests)                                                  |
| `NVD_API_KEY`            | api  | unset                   | Enables CVE Lookup                                                                     |
| `SECURITYTRAILS_API_KEY` | api  | unset                   | Enables Reverse IP                                                                     |
| `API_PROXY_TARGET`       | web  | `http://localhost:4000` | Vite dev proxy target for `/api`                                                       |
| `VITE_API_URL`           | web  | `/api`                  | API base URL used by the browser                                                       |

Port 3000 is often taken by other local projects on dev machines; that is why the API uses 4000.

## Platform notes

- **macOS privacy permissions and `ReconHelper`:** macOS only gives WiFi names/BSSIDs (Location
  Services) and Bluetooth scan results (Bluetooth permission) to app bundles holding those
  permissions; CLI tools can't get them. `apps/api/native/macos/ReconHelper` is a Swift app
  (`--mode wifi`: CoreWLAN; `--mode bluetooth`: CoreBluetooth for BLE + IOBluetooth inquiry for
  Classic). The API runs it via `core/native/macos-helper.ts` (`runHelper(mode, args)`, through
  `open` so macOS attributes the permission to the helper; results come back as a JSON file).
  Scan modes never prompt; `npm run setup:macos-helper` builds it and requests both permissions.
  New macOS-native features go into this helper as another `--mode`, not a new app.
- Without permission the tools degrade instead of failing: WiFi falls back to `system_profiler`
  (names `<redacted>`; treat as unknown, never group or dedupe on it) and Bluetooth to the paired
  devices list. They return a `HostNotice` (`redaction` / `notice`) that the UI shows with
  `HostNoticePanel`. The helper build output (`native/macos/build/`) is git-ignored; rebuilding
  changes its ad-hoc signature, so macOS may ask for permission again.
- **macOS BLE** exposes per-host UUIDs instead of MAC addresses; many devices rotate random
  addresses, so duplicates are expected. Classic inquiry only finds discoverable devices.
- **Linux Bluetooth** uses BlueZ `bluetoothctl --timeout N scan le|bredr` (one transport per run).
  **Windows Bluetooth** scanning is not implemented (returns 503).
- **Windows 11 24H2+** also requires Location permission for `netsh wlan show networks`.
