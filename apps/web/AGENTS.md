# AGENTS.md (apps/web)

Read the root `AGENTS.md` first. This file covers frontend structure and the design system.

## Stack

Vite 8, React 19, TanStack Router (file-based, `src/routes/`), TanStack Query, Tailwind CSS 4
(CSS-first config in `src/styles.css`, no tailwind.config), shadcn/ui (`components.json`,
style `new-york`, Radix), lucide-react icons, Zod (shared schemas from `@recon/shared`).

## Structure rules

- **Routes are thin.** A file in `src/routes/` only declares the route (`validateSearch`, loader
  if needed) and renders a component from `src/features/<id>`. No UI logic in route files.
- **Features own their UI.** `src/features/<id>/` contains `<id>-tool.tsx` (form state, uses
  `useToolRunner`) and `<id>-results.tsx` (pure rendering of the output type). Export the
  public component from `index.ts`. Features must not import from other features, except
  `features/registry.ts` and `features/system`.
- **Tool pages use the scaffold:** `ToolPage` > `TargetForm` (+ `FormOption` rows) >
  `ToolResultView`. It provides the header, active-mode warning, loading terminal, error panel,
  result meta bar and RAW JSON tab, so do not rebuild these per tool.
- **`useToolRunner(id, { initialTarget, buildInput })`** handles validation with the shared
  schema, the mutation, and auto-run when the route is opened with `?target=`.
- **Pivots:** wherever a result contains a hostname/IP/URL, render `<PivotLinks value=... exclude="<id>" />`
  so the user can jump to other tools. Which tools accept which target kind is configured in
  `TOOL_UI[id].accepts`.
- Server state goes through TanStack Query only. No ad-hoc `fetch` in components; use
  `apiFetch`/`apiPost` from `lib/api-client.ts`.

## Design system: cyberpunk HUD (+ themes)

Dark themes only. The default `cyber` theme's tokens are defined in `src/styles.css` (see the
header comment there). Alternative themes override those tokens under
`:root[data-theme='<id>']` in `src/themes/<id>.css`:

- `nothing`: Nothing-inspired. True black, white primary, one red accent, dot-matrix `font-dot`
  (Doto), dot grid, rounded panels, pill buttons, no glow/scanlines/glitch.

Theme switching lives in `lib/theme.ts` (`THEMES`, `useTheme`) and the `ThemeSwitcher` in the
top bar; the choice is stored in `localStorage` (`recon-theme`) and applied before first paint
by the inline script in `index.html`. To add a theme: add it to `THEMES`, the inline script's
allowlist, create `src/themes/<id>.css` and import it in `styles.css`. Theme files target
components through stable hooks (`data-slot="panel"`, `data-tone`, `.panel-corner`,
`data-slot="meter-segment"`, `data-slot="button"`), never through Tailwind class names.
Features stay theme-agnostic: keep using tones and tokens.

**Colour semantics (use the tone, not the hue):**

| Tone      | Tailwind                           | Meaning                                     |
| --------- | ---------------------------------- | ------------------------------------------- |
| `cyan`    | `text-neon-cyan`, `primary`        | primary actions, focus, links, neutral info |
| `magenta` | `text-neon-magenta`, `destructive` | errors, failures, critical findings         |
| `yellow`  | `text-neon-yellow`                 | warnings, active-mode notices               |
| `green`   | `text-neon-green`                  | success, pass, open/healthy                 |
| `muted`   | `text-muted-foreground`            | secondary text, empty states                |

Map domain states to a `Tone` (see `STATUS_TONE`, `gradeTone`, `expiryTone`) and use the
`toneText` / `toneBorder` / `toneBg` / `toneSoftBg` maps from `lib/tones.ts`. **Never** use raw
colour classes (`text-red-500`, hex values) in features.

**Typography:** `font-sans` is JetBrains Mono (all text). `font-display` (Orbitron) for
headings. `font-dot` for large hero text, page titles and grades (Orbitron in `cyber`, dot-matrix
in `nothing`, so never use it below ~20px). Labels are tiny uppercase with wide tracking:
`text-[10px] tracking-[0.2em] uppercase text-muted-foreground`.

**Primitives (`components/cyber`):**

- `Panel`: the container for any block of content (title shows as `// TITLE`, corner brackets,
  `tone` changes the border/accent). Use `bodyClassName="p-0"` for edge-to-edge lists.
- `Tag`: state/category labels. `Meter`: segmented 0-100 bar. `StatusDot`: live indicator.
- `KeyValueGrid`: record-style data; empty values render as a dim dash automatically.
- `Segmented` / `ChipToggle`: single/multi choice options inside `TargetForm`.
- `CopyButton`, `GlitchText` (dashboard hero only), `TerminalLoader` (used by ToolResultView).

**Effects (utilities in styles.css):** `text-glow`, `box-glow`, `clip-corner`, `clip-corner-sm`,
`bg-grid`, `animate-flicker`, `animate-blink`, `animate-scan`. Use glow sparingly, for the one
element that should draw the eye (grade letter, active nav item, open ports). Animations are
disabled automatically under `prefers-reduced-motion`.

**shadcn components** are restyled through CSS variables; `button.tsx` was additionally
tweaked (uppercase, clipped corners, glow on hover). After `shadcn add`, check that the new
component looks right on the dark theme and avoid hard-coded light-theme classes.

**Accessibility:** keep visible focus rings, `aria-label` on icon-only links/buttons, labels
on inputs, sufficient contrast (muted text only for secondary information), and make sure
layouts work at 360px width (sidebar becomes `MobileNav` below `md`).
