# Design: Brand-Match Reskin of the OpenTaint Playground

**Date:** 2026-05-25
**Status:** Approved (pending spec review)
**Scope:** Visual reskin + a few targeted layout tweaks. No information-architecture changes, no new runtime backend.

## Goal

Make the playground look and feel like a seamless extension of **opentaint.org**. Today it uses a generic dark-IDE palette (violet-ish `--accent`, gray taint highlight, default Monaco `vs-dark`). The product site has a distinctive, tasteful brand we will adopt verbatim so the playground reads as "part of the product" — which directly serves its job as a demo surface that converts evaluators into CLI installs.

## The opentaint.org brand (extracted from the live site CSS)

The site uses a shadcn/ui-style **HSL token system** with full light + dark sets, `hsl(var(--token))` at call sites. Signature traits:

- **Mono-forward typography.** Both `--font-sans` and `--font-mono` are **JetBrains Mono**. Headlines included.
- **Red is the brand.** `--brand` / `--accent` / `--primary` / `--ring` all = `0 72% 46%` (light) / `0 72% 52%` (dark) ≈ `#ca2121` / `#dd2c2c` (Tailwind red-600 family).
- **Cool near-black dark, clean white light.** Dark `--background: 215 14% 4%` (#090a0c, faint blue tint); light is pure white.
- **Flat & precise.** `box-shadow: none` everywhere; border-driven; `--radius: .5rem` (8px); one subtle brand gradient.
- **Code syntax palette.** Violet keyword, blue function, red string; taint highlighted in red.

## Confirmed decisions

| Question | Decision |
|---|---|
| Scope | Reskin + targeted layout tweaks (keep the IDE structure) |
| Aesthetic direction | Match opentaint.org exactly (both themes) |
| Taint flow coloring | **Monochrome red** — direction shown by intensity, not hue |
| Install CTA | **Copyable `curl … \| bash` chip** with a copy button, in brand red |
| Severity badges | **Brand-red mono scale** (intensity distinguishes levels) |

## Non-goals

- No layout/navigation redesign (activity bar, sidebar, editor + info split all stay).
- No live re-run backend (see existing decision: static playground only).
- No Tailwind adoption — the site uses it, but we stay on CSS custom properties + CSS modules to match the existing codebase and avoid a build/dependency change.
- No new icon library; harmonize existing unicode/emoji glyphs, don't replace wholesale.

## Architecture

### 1. Token layer (`src/theme.css`)

Replace the current flat vars with the two opentaint.org token sets, driven by the existing `:root[data-theme='light'|'dark']` attribute that `state/theme.ts` already toggles. Tokens are stored as **HSL component triples** (matching the source) and consumed via `hsl(var(--token))`; literal-hex syntax tokens (code colors) stay hex.

To avoid a large rename churn, the existing semantic aliases (`--bg`, `--bg-2`, `--bg-3`, `--fg`, `--fg-dim`, `--border`, `--accent`, `--header-bg`, `--sel`, `--sel-weak`) are **re-pointed** onto the new tokens in the same file, so component CSS keeps compiling. A follow-up pass renames call sites to the brand tokens and drops the aliases.

**Dark set** (hue 215/220):

| Token | HSL | ≈ hex |
|---|---|---|
| `--background` | `215 14% 4%` | #090a0c |
| `--band` | `215 12% 7.5%` | #0f1115 |
| `--card` | `215 10% 7%` | #0f1114 |
| `--foreground` | `215 6% 92%` | #e9eaec |
| `--muted` | `215 8% 11%` | #1a1c20 |
| `--muted-foreground` | `215 8% 38%` | #586069 |
| `--border` | `215 8% 15%` | #22252b |
| `--border-strong` | `215 6% 20%` | #2f333a |
| `--brand`/`--accent`/`--primary`/`--ring` | `0 72% 52%` | #dd2c2c |
| `--primary-foreground` | `0 0% 100%` | #ffffff |
| `--destructive` | `12 80% 50%` | #e8552e |
| `--code-bg` | `220 16% 10%` | #15181e |
| `--code-text` | — | #d4d4d8 |
| `--code-keyword` | — | #c4b5fd |
| `--code-fn` | — | #7dd3fc |
| `--code-string` | — | #f87171 |
| `--code-line-num` | — | #a1a1aa |
| `--code-taint-bg` | `0 72% 50% / .15` | red wash |
| `--code-taint-text` | — | #fca5a5 |

**Light set:**

| Token | HSL | ≈ hex |
|---|---|---|
| `--background` | `0 0% 100%` | #ffffff |
| `--band` | `215 16% 96.5%` | #f4f6f8 |
| `--card` | `0 0% 100%` | #ffffff |
| `--foreground` | `215 14% 8%` | #12151b |
| `--muted` | `215 10% 94%` | #eef0f3 |
| `--muted-foreground` | `215 6% 58%` | #8b9198 |
| `--border` | `215 10% 88%` | #dcdfe4 |
| `--border-strong` | `215 8% 76%` | #bdc2cb |
| `--brand`/`--accent`/`--primary`/`--ring` | `0 72% 46%` | #ca2121 |
| `--destructive` | `12 80% 46%` | #d44a26 |
| `--code-bg` | `220 14% 98%` | #f9fafb |
| `--code-text` | — | #3f3f46 |
| `--code-keyword` | — | #7c3aed |
| `--code-fn` | — | #0284c7 |
| `--code-string` | — | #dc2626 |
| `--code-line-num` | — | #52525b |
| `--code-taint-bg` | `0 72% 46% / .1` | red wash |
| `--code-taint-text` | — | #dc2626 |

Add `--radius: .5rem`. Remove the old `--src`/`--mid`/`--snk` green/amber/red triplet (taint goes monochrome; see §5).

### 2. Typography

Add `@fontsource/jetbrains-mono` (self-hosted, offline-friendly — no external request, fits a static playground) and import its weights in `main.tsx`. Set `--mono` and `--sans` both to `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`. Apply `letter-spacing: -0.02em` to the brand wordmark and any headings. Body stays at the current size; the mono face reads slightly wider, so verify density in trees/steps and nudge `font-size`/`line-height` if needed.

### 3. Component restyle (flat, border-driven, 8px radius, no shadows)

| File | Change |
|---|---|
| `components/TopBar.tsx` + `.module.css` | Red ● + `opentaint` wordmark; `share` + theme toggle as bordered token pills; **install CTA → copyable curl chip** (see §6). |
| `components/AppShell.module.css` | Panel handles, headers (`.shead`), borders re-pointed to tokens; section labels use `--muted-foreground`. |
| `components/ActivityBar` + `Tabs.module.css` | Active tab = brand-red indicator; inactive = `--muted-foreground`. |
| `components/FindingsTree` / `RulesTree` / `treeView.module.css` | Active row = faint brand wash (`hsl(var(--brand) / .12)`) + 2px brand left-border; filter input on `--card`/`--border`; slightly more row padding/line-height. |
| `components/InfoPanel` / `FindingInfo` / `StepsList` (+ css) | Token surfaces; current step = brand-red accent consistent with the code view. |
| `components/SeverityBadge.module.css` | Red-mono scale (see §4). |
| `components/EditorArea.module.css` | Tab + tabs/split toggle restyled to tokens; harmonize the `⟨⟩ ⚖ ⊟ ⊞` glyphs' color with `--muted-foreground`/active brand. |

### 4. Severity scale — brand-red mono (`SeverityBadge.module.css`, `util/severity.ts`)

Severity vocabulary is SARIF-style `error | warning | note` (labels unchanged: Error/Warning/Note). Map to one red ramp by intensity rather than three hues:

- `.error` → strong brand red: `color: hsl(var(--brand)); border-color: hsl(var(--brand))`, optional `background: hsl(var(--brand) / .12)`.
- `.warning` → muted red: `color: hsl(var(--brand) / .8)` on a fainter border/background.
- `.note` → neutral: `color: var(--muted-foreground)`.

No change to `severity.ts` logic — labels stay; only the badge CSS changes.

### 5. Taint decorations — monochrome red (`taint/decorations.ts` is unchanged; `theme.css` changes)

The decoration logic already emits three class names — `taint-faint` (rest of path), `taint-current` (current step, + `taint-arrow` gutter glyph), `taint-sink` (last step). We keep the logic and the class names; we **recolor** them to a single red ramp:

- `.taint-faint` → `hsl(var(--brand) / .12)` (matches `--code-taint-bg`).
- `.taint-current` → `hsl(var(--brand) / .30)`.
- `.taint-sink` → `hsl(var(--brand) / .45)`.
- `.taint-arrow::before` → `color: hsl(var(--brand))`.
- `.rule-focus` left border → `hsl(var(--brand))`.

Direction now reads as faint → medium → strong red along the flow, with the sink the most saturated — matching how the product site treats taint.

### 6. Install CTA — copyable curl chip (`TopBar.tsx` + `.module.css`)

Replace the `Install the CLI →` link with a compact command chip showing `curl -fsSL https://opentaint.org/install.sh | bash` (the site's real install command) in `--mono`, on a brand-red bordered surface, with a copy button. Behavior:

- Click copy → `navigator.clipboard.writeText(...)`; on success swap the icon to a check for ~1.5s; on failure (or missing clipboard API) fall back to selecting the text and show a "copy failed — select & copy" title. Never throw.
- The command string is a module constant (replaces the existing `INSTALL_URL`); keep an out-link affordance to opentaint.org as a secondary element so the brand wordmark/CTA still navigates.

This is the only behavioral addition; it gets a focused unit test (renders the command; copy invokes the clipboard; graceful fallback when `navigator.clipboard` is undefined).

### 7. Monaco custom theme (`components/CodeView.tsx`)

Define two `monaco.editor.defineTheme` themes — `ot-light` / `ot-dark` — from the site's syntax palette and code-bg tokens, and select by `useTheme().theme` (re-applied on toggle) instead of the stock `vs`/`vs-dark`:

- `editor.background` = `--code-bg`; `editorLineNumber.foreground` = `--code-line-num`.
- token rules: `keyword` → `#7c3aed`/`#c4b5fd`; `entity.name.function`/`identifier.function` → `#0284c7`/`#7dd3fc`; `string` → `#dc2626`/`#f87171`; default text → `--code-text`.
- Monaco theme colors must be concrete hex (no CSS vars), so define both palettes as TS constants derived from the token table above; keep them next to `CodeView` so they stay in sync with `theme.css`.

### 8. Targeted layout tweaks (minimal, in-scope)

- Tighten `TopBar` height/padding to echo the site header (slightly slimmer, denser).
- A touch more breathing room (padding / line-height) in the trees and `StepsList` so the mono face doesn't feel cramped.

Both are CSS-only and reversible.

## Testing strategy

- **Unit (Vitest):** Existing suites must stay green. Update tests that assert specific colors/legacy class semantics; the structure and `data-testid`s are unchanged. Add a `TopBar` test for the copy-chip (command rendered, clipboard called, fallback when clipboard API absent). Severity/taint logic tests are unaffected (only CSS changed).
- **E2E (Playwright):** Selectors are test-id/role based and unchanged, so flows hold. Add a smoke check that toggling the theme flips `data-theme` and the Monaco theme follows (assert the editor container is present in both themes).
- **Manual:** Eyeball both themes against opentaint.org for palette/type parity; verify taint path reads correctly with monochrome red; verify copy chip on a browser without clipboard permission.

## File-by-file change list

- `src/theme.css` — token rewrite (light + dark), aliases re-pointed, taint recolor, severity-source vars removed, `--radius` added.
- `src/main.tsx` — import JetBrains Mono webfont.
- `package.json` — add `@fontsource/jetbrains-mono`.
- `src/components/TopBar.tsx` + `TopBar.module.css` — wordmark, pills, copyable curl chip (+ test).
- `src/components/SeverityBadge.module.css` — red-mono scale.
- `src/components/CodeView.tsx` — `ot-light`/`ot-dark` Monaco themes, selected by theme.
- `src/components/AppShell.module.css`, `ActivityBar`/`Tabs.module.css`, `FindingsTree.module.css`, `RulesTree.module.css`, `treeView.module.css`, `InfoPanel.module.css`, `FindingInfo.module.css`, `StepsList.module.css`, `EditorArea.module.css` — token re-point + active-state brand wash + spacing nudges.
- Test updates where colors/classes are asserted.

## Risks & mitigations

- **Mono body text density.** JetBrains Mono is wider than the current sans; trees/tabs could feel cramped. Mitigate with the §8 spacing nudges; verify before finalizing.
- **Monaco/CSS token drift.** Monaco needs literal hex, so its palette duplicates the token table. Mitigate by colocating the palette constants with `CodeView` and referencing this spec's table as the source of truth.
- **Light-theme contrast.** Red-mono severity on white must stay legible at small sizes; use the strong `#ca2121` for borders/text, reserve faint washes for backgrounds only.
- **Clipboard API absence.** Handled by the copy-chip fallback (select text, never throw).

## Out of scope / future

- Renaming all legacy aliases to brand tokens (mechanical follow-up).
- Replacing unicode glyphs with a proper icon set.
- Any animation/motion polish beyond the copy-confirm micro-interaction.
