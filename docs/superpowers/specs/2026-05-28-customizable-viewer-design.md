# Customizable viewer — design

**Date:** 2026-05-28
**Status:** Approved (pending spec review)

## Problem

The viewer is hardwired to a single project. Generalizing it means three things the
user wants, in order:

1. **Deploy** the project while the repo stores only the necessary findings/sources/rules
   for one project, in a folder.
2. **Generate** that folder from a project's analysis with one command.
3. **Build a fully-offline static HTML** from that folder with one command.

Today the content is a single committed `src/content/java-spring-demo.json` (sources and
rules fully inlined, all 23 sources + all 47 rules), imported statically by
`loadContent.ts`. Project-specific coupling also lives in `scripts/regen-content.ts`
(hardcoded paths, Docker engine image, `VULN_BLURB`/`VULN_ORDER`, scenario curation,
`projectId`) and `src/pipeline/sarif.ts` (`DEFAULT_FLOW_OVERRIDES`).

## Goal

A generic viewer driven by a committed **data folder** containing one `content.json`,
produced by a parametrized generator command, and consumable two ways: served (deploy)
and inlined into one offline HTML. Remove the editorial **curation** layer entirely.

Non-goals: running the analyzer (the user brings a SARIF), multi-project switching in one
build, in-browser file upload, supporting non-OpenTaint SARIF shapes.

## Pipeline

```
 inputs                         gen (cmd 1)        data/                 build / build:single
 SARIF + src dir + rules dir  ───────────────▶  content.json  ──┬──▶  dist/        (deploy, cmd "1")
                                  (committed)                     └──▶  dist-single/ (offline, cmd 3)
```

- **Command 1 — generate:** `npm run gen -- --sarif <f> --src <dir> --rules <dir> [--name <id>] [--out data/content.json]`
- **Command (deploy) — req 1:** `npm run build` → `dist/` (reads `data/content.json`).
- **Command 3 — offline:** `npm run build:single` → `dist-single/index.html` (inlines `data/content.json`).

Producing the SARIF (running OpenTaint) is a documented prerequisite, out of scope.

## 1. Data model — `src/types/content.ts`

Remove curation, add tool metadata:

```ts
export interface ToolInfo {
  /** Analyzer name from the SARIF driver, e.g. "OpenTaint". */
  name: string;
  /** SARIF driver.semanticVersion, e.g. "0.3.0" (semver). */
  semanticVersion?: string;
  /** SARIF driver.version, e.g. "analyzer/2026.05.15.f15ed3a". */
  version?: string;
}

export interface ViewerContent {
  projectId: string;
  tool: ToolInfo;
  files: ProjectFile[];   // pruned to files referenced by a finding flow
  rules: RuleSpec[];      // the full ruleset from the rules dir
  findings: Finding[];
}
```

- Delete the `Scenario` interface and the `scenarios` field.
- `Finding` is unchanged (`flows` + `defaultFlowIndex`). `defaultFlowIndex` is now always
  the longest flow (no overrides).
- `isViewerContent`: drop the `scenarios` array check; add a shallow `tool` check
  (`typeof tool === 'object'`, `typeof tool.name === 'string'`). Keep the existing
  per-finding `flows`/`defaultFlowIndex` validation.

## 2. SARIF transform — `src/pipeline/sarif.ts`

- Remove `DEFAULT_FLOW_OVERRIDES`. `pickDefaultFlow` collapses to "longest flow, lowest
  index on ties" (rename to `longestFlowIndex(flows)`).
- Add `toolInfo(log: SarifLog): ToolInfo` reading `log.runs?.[0]?.tool?.driver`:
  `{ name: driver?.name ?? 'OpenTaint', semanticVersion: driver?.semanticVersion, version: driver?.version }`.
  Extend the local `SarifLog`/driver types with `name?`, `version?`, `semanticVersion?`.
- `transformSarif` is unchanged in signature (still returns `Finding[]`); `toolInfo` is a
  separate export the generator calls.

## 3. Generator — `scripts/gen-content.ts` (replaces `regen-content.ts`)

A generic, Docker-free CLI.

- **Args** (parsed from `process.argv`): `--sarif <file>` (required), `--src <dir>`
  (required), `--rules <dir>` (required), `--name <id>` (optional), `--out <file>`
  (optional, default `data/content.json`), `--root <dir>` (optional, default
  `dirname(--src)`). On a missing required arg, print usage and exit non-zero.

**Path matching (important):** a source file's stored `path` must equal the SARIF
`artifactLocation.uri` so findings resolve to it. Collected files are relativized against
`--root`, which must be the base the SARIF URIs are relative to (the scanned project
root). The default `dirname(--src)` matches the common `<root>/src/...` layout (and the
demo, where uris are `src/main/java/...`). Projects with a different base pass `--root`.
- **Steps:**
  1. Read + JSON-parse the SARIF.
  2. `findings = transformSarif(sarif)`; link each finding's `ruleFile` via the existing
     rule-id index (`buildRuleIndex`/`ruleFileFor`, unchanged) built from the rules dir.
  3. `rules` = every `.yaml`/`.yml` under `--rules` (existing `readRules`, parametrized by
     dir) — the **full** ruleset.
  4. `files` = source files under `--src` (existing `collectFiles`, parametrized by dir +
     extension allow-list) **pruned** to the set of file paths appearing in any finding's
     `flows[].steps[].file`. Paths stored relative to `--src`'s parent so they match the
     SARIF `artifactLocation.uri` (keep current relativization behavior).
  5. `tool = toolInfo(sarif)`.
  6. `projectId = --name ?? basename(resolve(--src))` (the project dir name).
  7. Assemble `{ projectId, tool, files, rules, findings }`, validate with
     `isViewerContent`, write pretty-printed JSON to `--out`.
- **Removed from the old script:** Docker scan + image digest, rule extraction from the
  image, `VULN_BLURB`, `VULN_ORDER`, `buildScenarios`, hardcoded `DEMO_DIR`/`OUT`/`projectId`.

**Pruning detail:** a referenced-files set is built from
`findings.flatMap(f => f.flows.flatMap(fl => fl.steps.map(s => s.file)))`; `collectFiles`
keeps only files whose stored path is in that set. (Findings' primary `file` is always a
flow step too, so it's covered.)

## 4. Loader — `src/content/loadContent.ts`

- `import raw from '../../data/content.json'` (was `./java-spring-demo.json`).
- `loadContent()`, `findingById`, `fileByPath`, `flowSteps`, `rulesByOrigin` unchanged
  otherwise. Add `tool(c)` accessor returning `c.tool` (or just read `content.tool` in the
  TopBar).
- Delete `src/content/java-spring-demo.json`; the committed default lives at
  `data/content.json` (the demo, regenerated to the new shape).

## 5. Store — `src/state/store.ts`

- Remove `scenarioId` from state, `selectScenario` from actions, and `scenarioId` from
  `PersistedView`/`partialize`/`merge`.
- `defaultFocus(content)`: pick `content.findings[0]` (or null), its `defaultFlowIndex`,
  focus the sink (last step of that flow); `activeFile` = that step's file; `activeRuleId`
  = `content.rules[0]?.id`.
- `loadContent` action: drop `scenarioOk`/`scenarioId` handling; otherwise unchanged
  (restore saved finding/flow/step if still valid, else `defaultFocus`).

## 6. Version display — `src/components/TopBar.tsx`

- Read `content.tool` from the store (add a `tool` selector or read via `loadContent`).
- After the logo, render a dimmed version chip **only when** `tool.semanticVersion ||
  tool.version` is present:
  - text: `v{semanticVersion}` if present, else `version`;
  - `title`: `{name} {version ?? ''}` (so the analyzer build string shows on hover);
  - `data-testid="tool-version"`.
- Style: small, `var(--fg-dim)`, mono, consistent with existing TopBar chips.

## 7. CLI ergonomics & docs

- `package.json`: replace `"regen": "tsx scripts/regen-content.ts"` with
  `"gen": "tsx scripts/gen-content.ts"`. `build` / `build:single` unchanged.
- README: document the three steps — produce a SARIF with OpenTaint (prereq), then
  `npm run gen -- --sarif … --src … --rules …`, then `npm run build` (deploy) or
  `npm run build:single` (offline).

## 8. Default committed content

Regenerate the demo into `data/content.json`:
`npm run gen -- --sarif java-spring-demo/results.sarif --src java-spring-demo/src --rules .opentaint-rules --name java-spring-demo`
(run offline against the existing on-disk inputs). This is the committed default so the
deployed playground works with zero args.

## Testing

- **`sarif.ts`:** `toolInfo` extracts name/semanticVersion/version (and defaults name to
  "OpenTaint", leaves versions undefined when absent — the fixture case); `defaultFlowIndex`
  = longest (the override test is removed in this change set, superseded).
- **`content.ts`:** `isViewerContent` accepts the new `{projectId, tool, files, rules,
  findings}` shape; rejects a missing/!object `tool`; (no longer requires `scenarios`).
- **`gen-content.ts`:** unit test — feed a tiny in-memory SARIF (two findings, one
  referencing `A.java`, an unreferenced `B.java` present in a temp `--src`) + temp
  `--rules`; assert the output prunes `B.java`, keeps all rule files, links `ruleFile`,
  sets `tool`, and computes longest `defaultFlowIndex`. Use temp dirs (`fs.mkdtemp`).
- **`store.ts`:** default focus derives from `findings[0]` (not scenarios); rehydrate/
  restore still works; no `scenarioId` anywhere.
- **`loadContent.test.ts`:** updated import/shape.
- **`TopBar.test.tsx`:** renders `tool-version` chip with `v0.3.0` and the analyzer build
  in `title` when tool has versions; renders nothing when versions absent.
- **e2e (`playground.spec.ts`):** derive `active` from `content.findings[0]`; drop
  `scenario` usage; the content interface gains `tool`. Add an assertion that the
  `tool-version` chip is visible.
- Regenerate `data/content.json`; the content-contract test covers the new shape.

## Files touched

| File | Change |
|---|---|
| `src/types/content.ts` | `ToolInfo` + `tool`; drop `Scenario`/`scenarios`; guard update |
| `src/pipeline/sarif.ts` | drop overrides → longest-only; add `toolInfo` |
| `scripts/gen-content.ts` | new generic generator (replaces `regen-content.ts`) |
| `scripts/regen-content.ts` | deleted |
| `src/content/loadContent.ts` | import `data/content.json`; tool accessor |
| `src/content/java-spring-demo.json` | deleted (moves to `data/content.json`) |
| `data/content.json` | new committed default (regenerated demo) |
| `src/state/store.ts` | remove scenarios; default focus = `findings[0]` |
| `src/components/TopBar.tsx` | version chip |
| `package.json` | `regen` → `gen` script |
| `README.md` | document the 3-step workflow |
| tests + `e2e/playground.spec.ts` | as above |
