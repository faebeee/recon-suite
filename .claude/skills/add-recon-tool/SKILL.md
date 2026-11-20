---
name: add-recon-tool
description: Add a new reconnaissance tool to Recon Suite as a full feature slice (shared schema + catalog, NestJS feature module, React feature UI and route). Use whenever the user asks to add, create or implement a new recon tool, scanner, lookup or module.
---

# Add a recon tool

A tool is a vertical slice with one kebab-case id (e.g. `security-txt`) used in shared, api
and web. Follow the steps in order; the TypeScript compiler catches missed registrations.
The examples below use the id `security-txt` (fetch `/.well-known/security.txt`) and the
PascalCase name `SecurityTxt`. Replace both.

Before starting, read the root `AGENTS.md` (security rules!) and look at the reference
implementations: `dns` (simple) and `http-headers` (outbound HTTP to a target).

## 0. Decide

- **Category**: `dns` | `intel` | `web` | `network` | `wireless` (add one to `ToolCategory` and
  `CATEGORY_LABELS` only if none fits).
- **Mode**: `passive` (only third-party sources) or `active` (connects to the target).
- **Scope**: `remote` (takes a `target`) or `local` (inspects the API host, no target). For
  local tools follow the variant section "Local tools" below and use `wifi` as reference.
- **Target kind**: domain (`domainSchema`), host/IP (`hostSchema`), URL (`httpUrlSchema`).
- **Code**: next free code in the category (`D-03`, `W-03`, `N-02`, `I-02`, ...).
- **Outbound path**: target connection -> `HttpClientService.target()` or
  `TargetGuardService.resolve()`; fixed third-party API -> `HttpClientService.trusted()`.

## 1. Shared contract (`packages/shared/src`)

`features/security-txt.ts`:

```ts
import { z } from 'zod';
import { domainSchema } from '../common/target.js';

export const securityTxtInputSchema = z.object({
  target: domainSchema,
});
export type SecurityTxtInput = z.input<typeof securityTxtInputSchema>;
/** Input after validation/defaults (what the API handler receives). */
export type SecurityTxtParams = z.output<typeof securityTxtInputSchema>;

export interface SecurityTxtOutput {
  url: string;
  found: boolean;
  fields: { name: string; value: string }[];
}
```

Then register it:

- `common/tool.ts`: append `'security-txt'` to `TOOL_IDS`.
- `catalog.ts`: add an entry to `TOOL_CATALOG` (id, code, name, tagline, description,
  category, mode, targetHint).
- `io.ts`: add to `TOOL_INPUT_SCHEMAS` and `ToolIO`.
- `index.ts`: `export * from './features/security-txt.js';`
- `pnpm --filter @recon/shared build`

If the tool grades or flags anything, add `findings: Finding[]` (from `common/finding.ts`) to the
output and pass it to `runTool` (see step 2); engagements pick it up automatically. Active tools
are scope-checked inside engagements on `target` (and a `hosts` array) with no extra code.

Rules: always name the target field `target`; bound every array/number (`.max()`); give
options sensible `.default()`s so `{ target }` alone is a valid request.

## 2. API feature (`apps/api/src/features/security-txt/`)

`security-txt.service.ts`: business logic; keep parsing in a pure function:

```ts
import { Injectable } from '@nestjs/common';
import type { SecurityTxtOutput, SecurityTxtParams } from '@recon/shared';
import { HttpClientService } from '../../core/http/http-client.service.js';
import { readTextLimited } from '../../core/http/read-limited.js';
import { parseSecurityTxt } from './security-txt.parser.js';

@Injectable()
export class SecurityTxtService {
  constructor(private readonly http: HttpClientService) {}

  async fetch({ target }: SecurityTxtParams): Promise<SecurityTxtOutput> {
    const url = `https://${target}/.well-known/security.txt`;
    const res = await this.http.target(url, { timeoutMs: 10_000 }); // guarded: target host
    if (!res.ok) {
      await res.body?.cancel();
      return { url, found: false, fields: [] };
    }
    const text = await readTextLimited(res, 256 * 1024);
    return { url, found: true, fields: parseSecurityTxt(text) };
  }
}
```

`security-txt.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  securityTxtInputSchema,
  type SecurityTxtOutput,
  type SecurityTxtParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { SecurityTxtService } from './security-txt.service.js';

@Controller('tools/security-txt')
export class SecurityTxtController {
  constructor(private readonly service: SecurityTxtService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: securityTxtInputSchema }) input: SecurityTxtParams,
  ): Promise<ToolResult<SecurityTxtOutput>> {
    return runTool(
      'security-txt',
      input.target,
      () => this.service.fetch(input),
      {
        // Graded results for engagement history and the report export (omit if none).
        findings: (d) => d.findings,
      },
    );
  }
}
```

`security-txt.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { SecurityTxtController } from './security-txt.controller.js';
import { SecurityTxtService } from './security-txt.service.js';

@Module({
  controllers: [SecurityTxtController],
  providers: [SecurityTxtService],
})
export class SecurityTxtModule {}
```

- Register `SecurityTxtModule` in `src/features/index.ts` (`FEATURE_MODULES`).
- Add the tool to `src/features/system/tool-runtime.ts` (engine and third-party services) and
  `src/features/system/platform-diagnostics.ts` (`() => OK` unless it needs OS tooling); both
  are `Record<ToolId, ...>`, so the typecheck fails until they are added.
- If the output contains an inventory worth monitoring (hosts, ports, endpoints, ...), add an
  extractor to `EXTRACTORS` in `src/features/engagements/changes.ts` so the Changes tab reports
  it in readable form (findings and grades are covered automatically).
- Add `security-txt.parser.spec.ts` testing the pure function. No network in tests; for
  services use a fake `HttpClientService` (pattern: `http-headers.service.spec.ts`).
- Throw Nest exceptions with human-readable messages (`NotFoundException`,
  `BadGatewayException`, `GatewayTimeoutException`). Let `TargetGuardService` throw 403s.
- Relative imports end in `.js`.

## 3. Web feature (`apps/web/src`)

`features/registry.ts`: add to `TOOL_UI`:

```ts
'security-txt': { icon: FileLock, tone: 'yellow', accepts: ['domain'] },
```

`features/security-txt/security-txt-tool.tsx`:

```tsx
import { TOOL_CATALOG } from '@recon/shared';
import { TargetForm, ToolPage, ToolResultView } from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { SecurityTxtResults } from './security-txt-results';

export function SecurityTxtTool({ initialTarget }: { initialTarget?: string }) {
  const runner = useToolRunner('security-txt', {
    initialTarget,
    buildInput: (target) => ({ target }), // add option state here (see dns-tool.tsx)
  });

  return (
    <ToolPage toolId="security-txt">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['security-txt'].targetHint}
        error={runner.validationError}
        label="Domain"
      >
        {/* <FormOption label="...">  Segmented / ChipToggle / Checkbox  </FormOption> */}
      </TargetForm>
      <ToolResultView mutation={runner.mutation} loadingLabel="Fetching">
        {(data) => <SecurityTxtResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
```

`features/security-txt/security-txt-results.tsx`: render the output with `Panel`,
`KeyValueGrid`, `Tag`, `Meter`; map states to tones; add `PivotLinks` for hostnames/IPs/URLs
in the output. Follow the design rules in `apps/web/AGENTS.md`.

`features/security-txt/index.ts`: `export { SecurityTxtTool } from './security-txt-tool';`

`routes/tools/security-txt.tsx` (thin; copy an existing one):

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { SecurityTxtTool } from '@/features/security-txt';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/security-txt')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    return <SecurityTxtTool key={target} initialTarget={target} />;
  },
});
```

Sidebar, dashboard card, quick-target launcher and pivots pick the tool up automatically
from the catalog + registry.

## Variant: local tools (no target)

References: `wifi` (interface dropdown, redaction fallback) and `bluetooth` (options-only input,
macOS helper + fallback, Linux CLI). Files: shared `features/<id>.ts`, api `features/<id>/`, web
`features/<id>/`.

- macOS APIs that need a privacy permission (Location, Bluetooth, ...): add a `--mode` to
  `apps/api/native/macos/ReconHelper` (Swift, one file per mode, add the usage string to its
  `Info.plist` and the permission request to `build.sh`), call it with `runHelper()` from
  `core/native/macos-helper.ts`, and return a `HostNotice` when falling back without permission
  (web: `HostNoticePanel`). Scan modes must never show a permission prompt.

- Shared: `inputSchema = z.object({})` (options only, no `target`); catalog `scope: 'local'`,
  `targetHint: ''`.
- Options that select a host resource (e.g. `interface`): strict regex in the schema, a helper
  `GET /api/tools/<id>/<name>` endpoint listing valid values for a UI dropdown, and an allowlist
  check in the service before the value is used as a command argument.
- API: run OS tooling only via `runCommand(cmd, FIXED_ARGS)` from `core/process/`, parse the
  output in pure per-platform parsers with fixture-based specs, and map `CommandNotFoundError` / `CommandFailedError` to `ServiceUnavailableException` with a
  message explaining the requirement (native run, hardware, OS package). Controller passes
  `os.hostname()` as target to `runTool`.
- Web: `TOOL_UI` entry with `accepts: []`; page = `ToolPage` + a `Panel` with a Scan button
  calling `runner.run()` (`useToolRunner(id, { buildInput: () => ({}) })`) + `ToolResultView`;
  the route file has no `validateSearch`.
- Verify on the dev machine (`curl -X POST localhost:4000/api/tools/<id> -d '{}' -H 'content-type: application/json'`)
  and state which platforms were only covered by fixture tests.

## 4. Verify

```sh
pnpm format && pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @recon/api test:e2e
```

Then smoke-test the endpoint against a public target while `pnpm dev` runs:

```sh
curl -s -X POST localhost:4000/api/tools/security-txt -H 'content-type: application/json' \
  -d '{"target":"github.com"}'
```

Report what you verified and anything you could not verify (e.g. no browser check).
