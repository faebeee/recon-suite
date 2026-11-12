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

- **Category**: `dns` | `intel` | `web` | `network` (add one to `ToolCategory` and
  `CATEGORY_LABELS` only if none fits).
- **Mode**: `passive` (only third-party sources) or `active` (connects to the target).
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
    return runTool('security-txt', input.target, () =>
      this.service.fetch(input),
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

## 4. Verify

```sh
pnpm format && pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @recon/api test:e2e
```

Then smoke-test the endpoint against a public target while `pnpm dev` runs:

```sh
curl -s -X POST localhost:4000/api/tools/security-txt -H 'content-type: application/json' \
  -d '{"target":"github.com"}'
```

Also confirm a private target is rejected for active tools (`{"target":"127.0.0.1"}` -> 403).
Report what you verified and anything you could not verify (e.g. no browser check).
