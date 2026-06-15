# OpenTaint Viewer — custom rules and missing-rule degrade

**Status:** Approved design (2026-06-15)

## Problem

Every finding carries a `ruleId` from the SARIF. The CLI resolves it to a rule
file by walking `--rules` and indexing each rule's `id:`; the viewer then turns
that into a clickable link (`FindingInfo` → Rules tab, scrolled to the rule).
Two cases are handled poorly today:

1. **Custom rules are not supported at all.** `RuleOrigin = 'builtin' | 'custom'`
   exists and `RulesTree` renders a **Custom** group, but the CLI hardcodes
   `origin: 'builtin'` for everything it reads. **Nothing ever produces a custom
   rule** — the Custom group is always "empty" and there is no way to feed the
   viewer a project's own rules.
2. **A `ruleId` with no matching rule file degrades silently.** `ruleFileFor`
   returns `null`, and `FindingInfo` renders the `ruleId` as a bare `<span>`. The
   finding is fully visible (vuln class, severity, CWE, message, and the
   SARIF-sourced description all still render), but the missing link looks like a
   styling glitch rather than an explained state.

We want to (a) let users supply their own rules and have them behave like
builtin rules — full source, tree entry, and finding link — and (b) make the
"no definition available" state explicit when a rule is in neither set.

## What the data already provides

- `transformSarif` reads each rule's `fullDescription` (markdown) and CWE tags
  from the report's `run.tool.driver.rules[]` and surfaces them as
  `finding.description` + `finding.cwe`. So even on the degrade path the user
  already sees the rule's description and CWE — we are **not** reconstructing rule
  *source* from the SARIF (explicitly out of scope).
- `RulesTree` already groups by `origin` (`Builtin`, `Custom`), renders each
  group's path tree, and selects/keys leaves by `rule.id` (which equals the
  ruleset-relative `path`). Populating `content.rules` with `origin: 'custom'`
  entries lights up the Custom group with **no UI changes**.
- `selectRule(path, anchor)` opens the Rules tab at `path` and scrolls to the
  rule whose inner `id:` matches `anchor` (the `ruleId`). This already works for
  any rule present in `content.rules`.

## Decisions (from brainstorming)

- **Two rule sources, by flag** (not auto-detection, not a mixed dir):
  - `--builtin-rules <dir>` — the engine's shipped ruleset, `origin: 'builtin'`.
    This is the **renamed `--rules`**; default and behavior are unchanged.
  - `--rules <dir>` — the user's own rules, `origin: 'custom'`. Optional.
- **`--rules` now means "your project's rules."** The bundled engine ruleset is
  named explicitly as `--builtin-rules`.
- **Custom wins on `id:` collision.** If a custom rule and a builtin rule declare
  the same inner `id:`, findings link to the custom one. This is the conservative
  stand-in for a rule `override` field, whose semantics are **deferred** (see Out
  of scope).
- **Degrade = a visible muted marker**, not bare text and not a synthesized stub.
- **No SARIF reconstruction.** A rule absent from both sets stays linkless; its
  description/CWE still come from the report via the existing transform.

## Command surface

```
opentaint-viewer serve  --sarif <file> [--src <dir>] [--builtin-rules <dir>] [--rules <dir>] [--name <id>] [--port <n>] [--no-open]
opentaint-viewer export --sarif <file> [--src <dir>] [--builtin-rules <dir>] [--rules <dir>] [--name <id>] [--out <file>]
```

| Flag | Origin | Required? | Default |
| --- | --- | --- | --- |
| `--builtin-rules <dir>` | `builtin` | no | `../lib/rules` relative to the CLI (the old `--rules` default) |
| `--rules <dir>` | `custom` | no | none |

- `--builtin-rules` keeps today's behavior: if the resolved dir does not exist,
  **fail** with the path it tried (the native install always ships it).
- `--rules` is optional. If **passed** and the dir does not exist → fail. If
  **absent**, no custom rules are loaded and any rule not in builtin hits the
  degrade path.
- The common case is still `--sarif` only: builtin resolves from the default, no
  custom rules, missing rules degrade.

## Default resolution

`resolve.ts` renames `resolveRulesDir` → `resolveBuiltinRulesDir(cliUrl,
builtinRulesArg)` with identical logic (`builtinRulesArg ?? ../lib/rules` next to
the CLI). Custom rules need no resolver: `--rules` is used verbatim
(`resolve(customArg)`) when provided, else omitted.

## Loading and indexing

`generateContent.ts`:

- Generalize `readRules(dir)` → `readRules(dir, origin)` — same walk/filter/sort,
  tagging each `RuleSpec` with the given origin.
- Read builtin from `builtinRulesDir` (origin `builtin`) and, when provided,
  custom from `customRulesDir` (origin `custom`).
- `content.rules = [...builtinRules, ...customRules]`, with one dedup rule below.
  This order is for tree display (Builtin group first) and is **independent** of
  index precedence.
- `buildRuleIndex` is first-write-wins today. To make a custom `id:` win on
  collision, feed it the rules **custom-first** (e.g. iterate `customRules` then
  `builtinRules`), regardless of `content.rules` display order.
- `ruleFileFor` is unchanged and can now resolve a `ruleId` to a custom file.

**`RuleSpec.id` uniqueness.** `id === path` (ruleset-relative). Distinct paths
across origins coexist normally. If a custom file has the **identical relative
path** as a builtin file, the custom entry **replaces** the builtin one in
`content.rules` (logged), keeping `id` unique for React keys and `find`. This is
the same "custom wins" stance applied at the file level.

## UI: degrade path

`FindingInfo.tsx` — when `finding.ruleFile` is `null`, keep the finding fully
visible but replace the bare `<span>{ruleId}</span>` with the `ruleId` followed
by a muted, non-interactive marker, e.g.:

```
rule: java.security.custom-thing  · definition not available
```

The marker is dimmed (reuses an existing muted style/`--fg-dim`) and carries a
`title` tooltip ("No rule definition was bundled for this rule id") so the state
reads as intentional rather than broken. The happy-path branch (clickable link)
is unchanged.

No other UI changes: the Custom tree group, rule selection, link-opening, and
focus-scroll all already work for any rule in `content.rules`.

## Data flow

```
serve/export
  -> resolveSourceRoot(sarif) + resolveBuiltinRulesDir(cli)         [+ optional --rules]
  -> generateContent(sarifLog, srcRoot, builtinRulesDir, customRulesDir?, name)
        readRules(builtin, 'builtin'); readRules(custom, 'custom')?
        rules = dedup([...builtin, ...custom])          (custom wins on same path)
        index = buildRuleIndex(custom-first)            (custom wins on same id:)
        findings.map(ruleFile = ruleFileFor(ruleId, index))   // may be a custom file or null
  -> injectContent(template, content)
  -> file (export) | http + open (serve)
```

## Error handling

Fail fast with actionable, user-facing messages:

- `--builtin-rules` dir missing → name the path tried, suggest `--builtin-rules`
  (unchanged from today's rules-dir error).
- `--rules` passed but dir missing → name the path, state it is the custom-rules
  dir.
- A rule in neither set is **not** an error — it degrades in the UI.
- Generated content still validated by `isViewerContent`.

## Components touched

```
src/cli/main.ts             parse --builtin-rules + --rules; update USAGE; pass both to generateContent
src/cli/args.ts             unchanged (generic --key value parser already covers both)
src/cli/resolve.ts          resolveRulesDir -> resolveBuiltinRulesDir (rename + same logic)
src/cli/generateContent.ts  readRules(dir, origin); load both; dedup; custom-first index
src/components/FindingInfo.tsx  degrade marker for ruleFile === null
README.md                   rename --rules -> --builtin-rules in the options table + examples;
                            document --rules as the custom-rules flag
```

No changes to `RulesTree`, `RulesView`, `loadContent`, the store, or
`src/types/content.ts` (`RuleOrigin`/`origin` already exist).

## Testing (TDD)

- **`generateContent`** — builtin-only (unchanged result); custom rules loaded
  and tagged `origin: 'custom'`; combined index resolves a finding to a custom
  file; custom wins on `id:` collision; custom file replaces builtin on identical
  relative path.
- **`resolve`** — `resolveBuiltinRulesDir` override vs. `../lib/rules` default
  (ported from the existing `resolveRulesDir` tests).
- **`main`/args** — `--builtin-rules` and `--rules` both parsed; `--builtin-rules`
  missing dir fails; `--rules` passed-but-missing fails; `--rules` absent →
  builtin-only content.
- **`FindingInfo`** — `ruleFile` set → renders the clickable link (happy path);
  `ruleFile: null` → renders the muted "definition not available" marker and the
  finding (vuln class, message, description) still renders.
- Existing builtin-path, RulesTree, and RulesView tests stay green.

## Out of scope (YAGNI)

- **The rule `override` field** — deferred. For now, collisions resolve by
  "custom wins" without reading any `override:` key. When override semantics are
  taken up, they refine *only* the index/dedup precedence.
- **Reconstructing rule source from the SARIF** for missing rules — the report's
  description/CWE already surface on the finding; we do not fabricate YAML.
- **A third rule origin or per-rule provenance beyond builtin/custom.**
- **Auto-discovery of a custom-rules dir** (env var, conventional path) — explicit
  `--rules` only.
