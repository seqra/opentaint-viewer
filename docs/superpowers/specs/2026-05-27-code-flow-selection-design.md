# Code-flow selection — design

**Date:** 2026-05-27
**Status:** Approved (pending spec review)

## Problem

OpenTaint emits one or more **code flows** per finding (a SARIF `result` can carry
several `codeFlows`, each describing a distinct source → sink taint path). The viewer
keeps only the first one and silently drops the rest:

```ts
// src/pipeline/sarif.ts (current)
const locs = res.codeFlows?.[0]?.threadFlows?.[0]?.locations ?? [];
```

The engine does **not** order code flows by completeness, so "always flow 0" is wrong
for some findings. Measured from the committed `java-spring-demo/results.sarif`
(13 results, 6 with >1 code flow):

| Finding | location | flow 0 | flow 1 | shown today |
|---|---|---:|---:|---|
| ssti-0 | TemplateRenderingService.java:30 | 8 | 10 | flow 0 (8) |
| ssti-1 | MarketingTemplateService.java:36 | 8 | 9 | flow 0 (8) |
| xss-2 | MessageController.java:57 | 30 | 14 | flow 0 (30) ✅ |
| xss-3 | MessageController.java:131 | 19 | 9 | flow 0 (19) ✅ |
| **xss-4** | **MessageController.java:96** | **10** | **26** | **flow 0 (10) ❌** |
| ssrf-5 | UrlFetchService.kt:33 | 13 | 9 | flow 0 (13) |

For `MessageController.java:96` the shown flow (10 steps) starts at
`MessageController.java:87 — "Marked data at method entry"`: the title is **already
tainted** at entry, so the trace is only the read-back-and-render half of a stored XSS.
The dropped flow (26 steps) is the full request → store → read → render story.

## Goal

Preserve every code flow, default to the most useful one per finding, and let the user
switch flows from the editor.

Chosen approach (**C**): keep all flows in the content, add a UI picker, **and** record
a curated default-flow index per finding during regen so the auto-pick can be overridden
where it is wrong.

Non-goals: changing the step-navigation semantics, multi-thread-flow rendering within a
single code flow, or any backend/live re-run work (see `live-backend-deferred`).

## 1. Data model — `src/types/content.ts`

A finding stops carrying a single `steps` array; it carries all of its flows plus a
curated default index.

```ts
export interface Flow {
  /** Ordered source → … → sink. Room to add a derived label later. */
  steps: TaintStep[];
}

export interface Finding {
  // …unchanged fields (id, ruleId, vulnClass, severity, endpoint, location, file,
  //   ruleFile, cwe, description, message)…
  flows: Flow[];             // length ≥ 1; preserves SARIF order so curated indices stay valid
  defaultFlowIndex: number;  // 0-based; which flow to show first
}
```

`steps` is **removed** from `Finding`. This is a breaking change to the content JSON
shape, so `src/content/java-spring-demo.json` must be regenerated (Docker + the demo
checkout — see regen prerequisites in the README).

`isViewerContent` gains a shallow check (kept consistent with the existing hand-rolled
guard; Zod is still deferred per `zod-validation-deferred-to-plan2`): each finding has a
non-empty `flows` array and an in-range numeric `defaultFlowIndex`.

## 2. Regen pipeline — `scripts/regen-content.ts` + `src/pipeline/sarif.ts`

`buildFinding` maps **every** `codeFlow` → a `Flow`, taking each code flow's first
thread flow (`threadFlows[0].locations`), exactly as the single-flow code does today.
The committed SARIF has exactly one thread flow per code flow; if a code flow ever has
more, the first is used and the rest ignored (out of scope).

Per-step transformation is unchanged: `kind` from explicit `kinds` or position
(`source`/`sink`/`propagation`), 1-based line, optional column span, label, and
`crossesFile` computed within the flow.

`defaultFlowIndex` is chosen by:

1. a **curated override table** keyed by a stable finding key
   `` `${ruleId} @ ${basename(uri)}:${line}` `` →
   e.g. `java.security.xss-in-spring-app @ MessageController.java:96` → `1`;
2. **fallback** when no override exists: the index of the longest flow (most steps);
   ties resolve to the lowest index.

This is deterministic and reproducible (engine pinned by digest), so curated indices
stay valid across regens. The override table lives in `sarif.ts` (so it is unit-testable)
and starts with the single entry for `MessageController.java:96`.

## 3. Store + persistence — `src/state/store.ts`

- New state field `activeFlowIndex: number`.
- A helper `activeFlow(finding, index)` (or inline `finding.flows[index].steps`) is the
  single source for "the steps currently in view".
- `defaultFocus`, `selectFinding`, `selectScenario` set
  `activeFlowIndex = finding.defaultFlowIndex` and focus that flow's **sink** (last step)
  — the same "land on the sink" behavior as today.
- New action `stepFlow(op: 'prev' | 'next')`: clamps `activeFlowIndex` within
  `[0, flows.length - 1]`, then focuses the new flow's sink (last step).
- `step()` (next/back/over/out/start/end) and the editor decorations read
  `finding.flows[activeFlowIndex].steps` instead of `finding.steps`.
- Persistence: `activeFlowIndex` joins the persisted view slice (`PersistedView` +
  `partialize`). On rehydrate / `loadContent`, it is clamped to the active finding's flow
  range, falling back to `defaultFlowIndex` when out of range or missing — matching the
  existing "restore saved view if still valid, else curated default" pattern.

## 4. UI — `src/components/CodeView.tsx`, `StepsList.tsx`

**Editor step-nav (`CodeView`):** a compact flow group sits to the **left** of the
existing step buttons, separated by a divider — a flow glyph (e.g. Lucide `GitFork`),
prev/next buttons, and an `m/n` indicator, all reusing the existing `navBtn` style. It
reads left-to-right as *Flow 2 of 2 · step 12 of 26*:

```
…:96  Message.java     ⑂ ‹ 2/2 › │ ⏮ ◀◀ ◀ ▲ ▶ ▶▶ ⏭  12/26
```

- The whole flow group is **hidden** when `finding.flows.length === 1`.
- Prev/next disable at the ends, consistent with the step buttons.
- Buttons call `stepFlow('prev' | 'next')`. Test ids: `flow-nav`, `flow-prev`,
  `flow-next`.

**Steps list (`StepsList`):** renders the active flow's steps
(`finding.flows[activeFlowIndex].steps`). It gains a small **non-interactive** header
line (`Flow 2 of 2 · 26 steps`) shown only when `flows.length > 1`, for context — the
control itself stays in the editor.

## Testing

- **`sarif.ts`:** multiple `codeFlows` → multiple `Flow`s in order; longest-flow fallback
  for `defaultFlowIndex`; curated override applied for the keyed finding; single-flow
  result → `flows.length === 1`, `defaultFlowIndex === 0`.
- **`store.ts`:** `stepFlow` clamping at both ends; `activeFlowIndex` resets to
  `defaultFlowIndex` on `selectFinding`/`selectScenario`; rehydrate clamps an
  out-of-range persisted `activeFlowIndex`.
- **`content.ts`:** `isViewerContent` rejects empty `flows` / out-of-range
  `defaultFlowIndex`.
- **Component (`CodeView`, `StepsList`):** flow group hidden for single-flow findings;
  prev/next disabled at ends; switching flow updates the rendered steps and decorations;
  Steps header appears only for multi-flow findings.
- **e2e (`playground.spec.ts`):** add a step that switches flow on `MessageController.java:96`
  and asserts a source-side step (from the longer flow) becomes visible. Expectations stay
  derived from the committed content so they survive regen.
- **Committed content:** regenerate `src/content/java-spring-demo.json` so `flows` and
  `defaultFlowIndex` exist; the existing content-contract test covers the new shape.

## Files touched

| File | Change |
|---|---|
| `src/types/content.ts` | `Flow`; `Finding.flows` + `defaultFlowIndex`; drop `steps`; guard update |
| `src/pipeline/sarif.ts` | map all code flows; curated override table + longest fallback |
| `scripts/regen-content.ts` | emit `flows` / `defaultFlowIndex` (via the updated transform) |
| `src/state/store.ts` | `activeFlowIndex`, `stepFlow`, flow-aware focus, persistence |
| `src/components/CodeView.tsx` | flow nav buttons in the step-nav |
| `src/components/StepsList.tsx` | read active flow; optional multi-flow header |
| `src/content/java-spring-demo.json` | regenerated to the new shape |
| tests + `e2e/playground.spec.ts` | as above |
