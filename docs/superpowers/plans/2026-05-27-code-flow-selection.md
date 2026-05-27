# Code-flow Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every SARIF code flow per finding, default to a curated/most-complete flow, and let the user switch flows with prev/next buttons in the editor step-nav.

**Architecture:** A finding gains `flows: Flow[]` + `defaultFlowIndex` (replacing the single `steps`). The SARIF transform maps all code flows and picks a default via a curated override table with a longest-flow fallback. The store tracks `activeFlowIndex`; the editor and steps list read the active flow. The migration keeps a *derived* `steps` field through Tasks 1–6 so the build stays green, then drops it in Task 7.

**Tech Stack:** TypeScript, React 18, Zustand (+persist), Vite, Vitest + Testing Library, Playwright. Content is a committed JSON regenerated offline by `scripts/regen-content.ts` (reuses the existing `java-spring-demo/results.sarif` + `.opentaint-rules`, so **no Docker is needed** for this work).

**Spec:** `docs/superpowers/specs/2026-05-27-code-flow-selection-design.md`

**Key facts the engineer needs:**
- The real SARIF (`java-spring-demo/results.sarif`) has 13 results; 6 carry 2 code flows. Each code flow has exactly one thread flow.
- HEAD already contains a **partial fix** (commit `8c7c0e1`): `longestFlow(res)` in `src/pipeline/sarif.ts` picks the longest threadFlow across all code flows, so `MessageController.java:96` already shows the full 26 steps. This plan **upgrades** that — keep *all* flows and let the user switch. The longest heuristic becomes the *fallback* inside `pickDefaultFlow`, and the `longestFlow` function is removed (Task 1). There is also a pre-existing test `describe('transformSarif codeFlow selection', …)` in `sarif.test.ts` covering `longestFlow`; it stays green through Tasks 1–6 (derived `steps` = longest) and is removed in Task 7.
- The committed content JSON is validated at load by `isViewerContent`; **many tests call `loadContent()`**, so the JSON must satisfy the guard after every task. That dictates the task order (transform → regen → tighten guard).
- On load, `activeFlowIndex === defaultFlowIndex`, so the active flow equals the default flow. Test helpers derived from `flows[defaultFlowIndex].steps` therefore match what renders on first paint.

---

## Task 1: Add `Flow` model + multi-flow transform (keep derived `steps`)

**Files:**
- Modify: `src/types/content.ts`
- Modify: `src/pipeline/sarif.ts`
- Test: `src/pipeline/sarif.test.ts`

- [ ] **Step 1: Add the `Flow` type and the new `Finding` fields**

In `src/types/content.ts`, add `Flow` after the `TaintStep` interface (around line 18) and extend `Finding`:

```ts
export interface Flow {
  /** Ordered source → … → sink for one code flow. */
  steps: TaintStep[];
}
```

In the `Finding` interface, keep all existing fields and add (do **not** remove `steps` yet — it stays as a derived convenience until Task 7):

```ts
  /** Every code flow the engine reported for this finding (≥ 1, in SARIF order). */
  flows: Flow[];
  /** Which flow to show first (0-based, in range of `flows`). */
  defaultFlowIndex: number;
```

Leave `isViewerContent` unchanged in this task (it stays loose so the not-yet-regenerated JSON still validates).

- [ ] **Step 2: Write failing transform tests for multiple flows + default selection**

Append to `src/pipeline/sarif.test.ts` (the fixture has a single flow, so add a synthetic multi-flow log inline):

```ts
describe('transformSarif — code flows', () => {
  const tfl = (uri: string, line: number, text: string) => ({
    location: { physicalLocation: { artifactLocation: { uri }, region: { startLine: line } }, message: { text } },
    kinds: ['taint'],
  });
  const flow = (...locs: ReturnType<typeof tfl>[]) => ({ threadFlows: [{ locations: locs }] });
  const result = (ruleId: string, line: number, codeFlows: ReturnType<typeof flow>[]) => ({
    ruleId,
    level: 'error',
    message: { text: 'm' },
    locations: [{ physicalLocation: { artifactLocation: { uri: 'A.java' }, region: { startLine: line } } }],
    codeFlows,
  });

  it('keeps every code flow as a Flow, in order', () => {
    const log = { runs: [{ results: [result('java.security.ssti', 30, [
      flow(tfl('A.java', 1, 'a'), tfl('A.java', 2, 'b')),
      flow(tfl('A.java', 3, 'c'), tfl('A.java', 4, 'd'), tfl('A.java', 5, 'e')),
    ])] }] };
    const f = transformSarif(log)[0];
    expect(f.flows).toHaveLength(2);
    expect(f.flows[0].steps).toHaveLength(2);
    expect(f.flows[1].steps).toHaveLength(3);
    expect(f.flows[0].steps[0].kind).toBe('source');
  });

  it('defaults to the longest flow when there is no curated override', () => {
    const log = { runs: [{ results: [result('java.security.ssti', 30, [
      flow(tfl('A.java', 1, 'a'), tfl('A.java', 2, 'b')),
      flow(tfl('A.java', 3, 'c'), tfl('A.java', 4, 'd'), tfl('A.java', 5, 'e')),
    ])] }] };
    expect(transformSarif(log)[0].defaultFlowIndex).toBe(1);
  });

  it('honors the curated override for MessageController.java:96 (the 26-step stored-XSS flow)', () => {
    const log = { runs: [{ results: [{
      ruleId: 'java.security.xss-in-spring-app',
      level: 'error',
      message: { text: 'm' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'a/MessageController.java' }, region: { startLine: 96 } } }],
      codeFlows: [
        flow(tfl('a/MessageController.java', 87, 'short')),                                  // flow 0: shorter
        flow(tfl('a/MessageController.java', 33, 'long'), tfl('a/MessageController.java', 96, 'sink')), // flow 1: longer/curated
      ],
    }] }] };
    expect(transformSarif(log)[0].defaultFlowIndex).toBe(1);
  });

  it('a result with no code flows still yields one empty flow', () => {
    const log = { runs: [{ results: [{ ruleId: 'r', level: 'error', message: { text: 'm' }, locations: [] }] }] };
    const f = transformSarif(log)[0];
    expect(f.flows).toHaveLength(1);
    expect(f.flows[0].steps).toEqual([]);
    expect(f.defaultFlowIndex).toBe(0);
  });

  it('keeps `steps` as the default flow (back-compat until removal)', () => {
    const log = { runs: [{ results: [result('java.security.ssti', 30, [
      flow(tfl('A.java', 1, 'a')),
      flow(tfl('A.java', 3, 'c'), tfl('A.java', 4, 'd')),
    ])] }] };
    const f = transformSarif(log)[0];
    expect(f.steps).toBe(f.flows[f.defaultFlowIndex].steps);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/pipeline/sarif.test.ts`
Expected: FAIL — `f.flows` is undefined / `defaultFlowIndex` missing.

- [ ] **Step 4: Implement the multi-flow transform**

In `src/pipeline/sarif.ts`:

1. Import `Flow`: change the type import on line 1 to
```ts
import type { Finding, Flow, Severity, TaintStep } from '../types/content';
```

2. Add the curated override table and default-flow picker above `buildFinding`:
```ts
/** Per-finding default code-flow override, keyed by `${ruleId} @ ${primaryLocation}`. */
const DEFAULT_FLOW_OVERRIDES: Record<string, number> = {
  'java.security.xss-in-spring-app @ MessageController.java:96': 1,
};

function pickDefaultFlow(ruleId: string, location: string | null, flows: Flow[]): number {
  const override = location ? DEFAULT_FLOW_OVERRIDES[`${ruleId} @ ${location}`] : undefined;
  if (override != null && override >= 0 && override < flows.length) return override;
  let best = 0; // longest flow wins; ties resolve to the lowest index
  for (let i = 1; i < flows.length; i++) if (flows[i].steps.length > flows[best].steps.length) best = i;
  return best;
}
```

3. **Delete the `longestFlow` function** (the `/** Pick the most complete trace … */` helper directly above `buildFinding`) — mapping every flow plus the longest fallback in `pickDefaultFlow` supersedes it. Then extract the per-step mapping into a helper and rewrite `buildFinding` so it no longer calls `longestFlow`:
```ts
function buildSteps(locs: SarifTfl[]): TaintStep[] {
  return locs.map((tfl, i) => {
    const file = fileOf(tfl);
    const prevFile = i > 0 ? fileOf(locs[i - 1]) : file;
    const explicit = tfl.kinds?.find(
      (k): k is TaintStep['kind'] => k === 'source' || k === 'sink' || k === 'sanitizer',
    );
    const region = tfl.location?.physicalLocation?.region;
    return {
      index: i,
      kind: explicit ?? kindForPosition(i, locs.length),
      file,
      line: region?.startLine ?? 1,
      startColumn: region?.startColumn,
      endLine: region?.endLine,
      endColumn: region?.endColumn,
      label: tfl.location?.message?.text ?? '',
      crossesFile: i > 0 && file !== prevFile,
    };
  });
}

function buildFinding(res: SarifResult, idx: number, meta: Map<string, RuleMeta>): Finding {
  const ruleId = res.ruleId ?? 'unknown';
  const flows: Flow[] = (res.codeFlows ?? []).map((cf) => ({
    steps: buildSteps(cf.threadFlows?.[0]?.locations ?? []),
  }));
  if (flows.length === 0) flows.push({ steps: [] }); // keep `flows` non-empty
  const location = primaryLocation(res);
  const defaultFlowIndex = pickDefaultFlow(ruleId, location, flows);
  return {
    id: `${ruleId}-${idx}`,
    ruleId,
    vulnClass: vulnClassForRule(ruleId),
    severity: severityFromLevel(res.level),
    endpoint: null,
    location,
    file: primaryFile(res),
    ruleFile: null,
    cwe: meta.get(ruleId)?.cwe ?? [],
    description: meta.get(ruleId)?.description,
    message: res.message?.text ?? '',
    flows,
    defaultFlowIndex,
    steps: flows[defaultFlowIndex].steps, // derived; removed in Task 7
  };
}
```

- [ ] **Step 5: Run the full test suite to verify green**

Run: `npm test`
Expected: PASS. The existing single-flow fixture tests still pass (one code flow → `flows[0]`, `steps` unchanged). `npx tsc --noEmit` must also pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/content.ts src/pipeline/sarif.ts src/pipeline/sarif.test.ts
git commit -m "feat: parse all SARIF code flows with a curated default flow"
```

---

## Task 2: Regenerate the committed content JSON

**Files:**
- Modify: `src/content/java-spring-demo.json` (generated)

- [ ] **Step 1: Confirm the offline regen inputs exist**

Run: `ls java-spring-demo/results.sarif && ls .opentaint-rules/java`
Expected: both exist (regen reuses them; no Docker scan runs).

- [ ] **Step 2: Regenerate**

Run: `npm run regen`
Expected: `Wrote src/content/java-spring-demo.json: 13 findings, 23 files, 47 rules, 3 scenarios`.

- [ ] **Step 3: Verify the new shape and the `:96` default flip**

Run:
```bash
node -e "const c=require('./src/content/java-spring-demo.json'); const f=c.findings.find(x=>x.location==='MessageController.java:96'); console.log('flows',f.flows.map(fl=>fl.steps.length),'default',f.defaultFlowIndex,'defaultLen',f.flows[f.defaultFlowIndex].steps.length);"
```
Expected: `flows [ 10, 26 ] default 1 defaultLen 26` (the full stored-XSS trace is now the default).

- [ ] **Step 4: Run tests (content still validates under the loose guard)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/java-spring-demo.json
git commit -m "chore: regenerate content with all code flows"
```

---

## Task 3: Tighten the content guard

**Files:**
- Modify: `src/types/content.ts`
- Test: `src/types/content.test.ts`

- [ ] **Step 1: Write failing guard tests**

In `src/types/content.test.ts`, the valid object on lines 6–12 currently has `steps: []` on its finding. Replace that finding to use `flows` and add rejection cases. Replace the whole `describe` body's first `it` finding and add a third `it`:

```ts
  it('accepts a minimal valid content object', () => {
    const c = {
      projectId: 'java-spring-demo',
      scenarios: [{ id: 's1', title: 'SQLi', blurb: 'b', startFile: 'A.java', defaultFindingId: 'f1' }],
      files: [{ path: 'A.java', language: 'java', content: '...' }],
      findings: [{ id: 'f1', ruleId: 'sqli', vulnClass: 'SQL Injection', severity: 'error', endpoint: null, message: 'm', flows: [{ steps: [] }], defaultFlowIndex: 0 }],
      rules: [{ id: 'sqli', origin: 'builtin', kind: 'rule', path: 'Builtin/rule/sqli.yaml', content: 'id: sqli' }],
    };
    expect(isViewerContent(c)).toBe(true);
  });

  it('rejects a finding with no flows or an out-of-range default index', () => {
    const base = { projectId: 'p', scenarios: [], files: [], rules: [] };
    const finding = (extra: object) => ({ findings: [{ id: 'f', ruleId: 'r', vulnClass: 'X', severity: 'error', endpoint: null, message: 'm', ...extra }] });
    expect(isViewerContent({ ...base, ...finding({ flows: [], defaultFlowIndex: 0 }) })).toBe(false);
    expect(isViewerContent({ ...base, ...finding({ flows: [{ steps: [] }], defaultFlowIndex: 5 }) })).toBe(false);
    expect(isViewerContent({ ...base, ...finding({ flows: [{ steps: [] }] }) })).toBe(false);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/types/content.test.ts`
Expected: FAIL — the loose guard accepts the invalid findings.

- [ ] **Step 3: Tighten `isViewerContent`**

Replace the `isViewerContent` function in `src/types/content.ts` with:

```ts
export function isViewerContent(value: unknown): value is ViewerContent {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  if (
    typeof c.projectId !== 'string' ||
    !Array.isArray(c.scenarios) ||
    !Array.isArray(c.files) ||
    !Array.isArray(c.findings) ||
    !Array.isArray(c.rules)
  ) {
    return false;
  }
  return (c.findings as unknown[]).every((f) => {
    if (typeof f !== 'object' || f === null) return false;
    const finding = f as Record<string, unknown>;
    const flows = finding.flows;
    const idx = finding.defaultFlowIndex;
    return (
      Array.isArray(flows) &&
      flows.length > 0 &&
      typeof idx === 'number' &&
      Number.isInteger(idx) &&
      idx >= 0 &&
      idx < flows.length
    );
  });
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS (the regenerated JSON satisfies the stricter guard).

- [ ] **Step 5: Commit**

```bash
git add src/types/content.ts src/types/content.test.ts
git commit -m "feat: validate flows and defaultFlowIndex in the content guard"
```

---

## Task 4: Store — `activeFlowIndex`, `stepFlow`, flow-aware focus & persistence

**Files:**
- Modify: `src/content/loadContent.ts` (add `flowSteps` helper)
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

- [ ] **Step 1: Add the `flowSteps` selector**

`src/content/loadContent.ts` already imports `Finding` on line 3. Add `TaintStep` to that
existing `import type` line:

```ts
import type { Finding, ViewerContent, ProjectFile, RuleOrigin, RuleSpec, TaintStep } from '../types/content';
```

Then append the helper:

```ts
/** Steps of a finding's flow, clamping the index into range. */
export function flowSteps(f: Finding, flowIndex: number): TaintStep[] {
  const i = Math.min(f.flows.length - 1, Math.max(0, flowIndex));
  return f.flows[i]?.steps ?? [];
}
```

- [ ] **Step 2: Write failing store tests**

In `src/state/store.test.ts`, update the multi-flow fixture and existing `.steps` references to go through the default flow, and add flow tests. Replace lines 6–8 with:

```ts
const content = loadContent();
const scenario = content.scenarios[0];
const stepsOf = (f: typeof content.findings[number]) => f.flows[f.defaultFlowIndex].steps;
const multiStep = content.findings.find((f) => stepsOf(f).length > 1)!;
const multiFlow = content.findings.find((f) => f.flows.length > 1)!;
```

Then, throughout the existing tests, replace `multiStep.steps` with `stepsOf(multiStep)` and `defaultFinding.steps` with `defaultFinding.flows[defaultFinding.defaultFlowIndex].steps`. Add these new tests inside the `describe`:

```ts
  it('loadContent sets activeFlowIndex to the default and focuses that flow\'s sink', () => {
    useStore.getState().loadContent(content);
    const s = useStore.getState();
    const f = content.findings.find((x) => x.id === scenario.defaultFindingId)!;
    expect(s.activeFlowIndex).toBe(f.defaultFlowIndex);
    expect(s.activeStepIndex).toBe(f.flows[f.defaultFlowIndex].steps.length - 1);
  });

  it('selectFinding resets the flow to the finding\'s default', () => {
    useStore.getState().loadContent(content);
    useStore.setState({ activeFlowIndex: 999 });
    useStore.getState().selectFinding(multiFlow.id);
    expect(useStore.getState().activeFlowIndex).toBe(multiFlow.defaultFlowIndex);
  });

  it('stepFlow moves between flows, clamps at the ends, and focuses the new flow\'s sink', () => {
    useStore.getState().loadContent(content);
    useStore.getState().selectFinding(multiFlow.id);
    // Move to flow 0 then try to go before it (clamped).
    useStore.setState({ activeFlowIndex: 1 });
    useStore.getState().stepFlow('prev');
    expect(useStore.getState().activeFlowIndex).toBe(0);
    useStore.getState().stepFlow('prev');
    expect(useStore.getState().activeFlowIndex).toBe(0); // clamped
    useStore.getState().stepFlow('next');
    const i = useStore.getState().activeFlowIndex;
    expect(i).toBe(1);
    expect(useStore.getState().activeStepIndex).toBe(multiFlow.flows[i].steps.length - 1);
  });

  it('loadContent clamps an out-of-range persisted activeFlowIndex to the default', () => {
    useStore.setState({ activeFindingId: multiFlow.id, activeFlowIndex: 99, activeStepIndex: 0, activeFile: multiFlow.flows[0].steps[0].file, content: null });
    useStore.getState().loadContent(content);
    expect(useStore.getState().activeFlowIndex).toBe(multiFlow.defaultFlowIndex);
  });
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/state/store.test.ts`
Expected: FAIL — `activeFlowIndex` / `stepFlow` do not exist.

- [ ] **Step 4: Implement the store changes**

In `src/state/store.ts`:

1. Add to the imports near the top:
```ts
import { findingById, flowSteps } from '../content/loadContent';
```
(replace the existing `import { findingById } from '../content/loadContent';`).

2. In `interface State`, add after `activeStepIndex`:
```ts
  /** Which code flow of the active finding is shown (0-based). */
  activeFlowIndex: number;
```

3. In `interface Actions`, add after `step`:
```ts
  stepFlow: (op: 'prev' | 'next') => void;
```

4. In `const initial`, add `activeFlowIndex: 0,` alongside `activeStepIndex: null`.

5. Replace `defaultFocus` with:
```ts
/** Curated default focus: the default flow of the default finding, on its sink. */
function defaultFocus(content: ViewerContent) {
  const scenario = content.scenarios[0] ?? null;
  const finding = scenario ? findingById(content, scenario.defaultFindingId) : undefined;
  const flowIndex = finding?.defaultFlowIndex ?? 0;
  const steps = finding ? flowSteps(finding, flowIndex) : [];
  const lastIdx = steps.length ? steps.length - 1 : null;
  return {
    scenarioId: scenario?.id ?? null,
    activeFindingId: scenario?.defaultFindingId ?? null,
    activeFlowIndex: flowIndex,
    activeStepIndex: lastIdx,
    activeFile: steps[lastIdx ?? 0]?.file ?? scenario?.startFile ?? null,
    activeRuleId: content.rules[0]?.id ?? null,
  };
}
```

6. Replace the `loadContent` action body with:
```ts
  loadContent: (content) => {
    const s = get();
    const savedFinding = s.activeFindingId ? findingById(content, s.activeFindingId) : undefined;
    if (savedFinding) {
      const flowOk =
        Number.isInteger(s.activeFlowIndex) && s.activeFlowIndex >= 0 && s.activeFlowIndex < savedFinding.flows.length;
      const flowIndex = flowOk ? s.activeFlowIndex : savedFinding.defaultFlowIndex;
      const steps = flowSteps(savedFinding, flowIndex);
      const stepOk =
        typeof s.activeStepIndex === 'number' && s.activeStepIndex >= 0 && s.activeStepIndex < steps.length;
      if (stepOk) {
        const fileOk = s.activeFile != null && content.files.some((f) => f.path === s.activeFile);
        const ruleOk = s.activeRuleId != null && content.rules.some((r) => r.id === s.activeRuleId);
        const scenarioOk = content.scenarios.some((sc) => sc.id === s.scenarioId);
        set({
          content,
          scenarioId: scenarioOk ? s.scenarioId : content.scenarios[0]?.id ?? null,
          activeFindingId: s.activeFindingId,
          activeFlowIndex: flowIndex,
          activeStepIndex: s.activeStepIndex,
          activeFile: fileOk ? s.activeFile : steps[s.activeStepIndex!].file,
          activeRuleId: ruleOk ? s.activeRuleId : content.rules[0]?.id ?? null,
        });
        return;
      }
    }
    set({ content, ...defaultFocus(content) });
  },
```

7. Replace `selectScenario`, `selectFinding`, `selectStep`, and `step` with flow-aware versions, and add `stepFlow`:
```ts
  selectScenario: (id) => {
    const c = get().content;
    const scenario = c?.scenarios.find((s) => s.id === id);
    if (!scenario) return;
    const f = c ? findingById(c, scenario.defaultFindingId) : undefined;
    set({ scenarioId: id, activeFindingId: scenario.defaultFindingId, activeFlowIndex: f?.defaultFlowIndex ?? 0, activeStepIndex: 0, activeFile: scenario.startFile });
  },

  selectFinding: (id) => {
    const c = get().content;
    const f = c ? findingById(c, id) : undefined;
    const flowIndex = f?.defaultFlowIndex ?? 0;
    const steps = f ? flowSteps(f, flowIndex) : [];
    const lastIdx = Math.max(0, steps.length - 1);
    set({ activeFindingId: id, activeFlowIndex: flowIndex, activeStepIndex: lastIdx, activeFile: steps[lastIdx]?.file ?? get().activeFile, activeTab: 'code' });
  },

  selectStep: (findingId, index) => {
    const c = get().content;
    const f = c ? findingById(c, findingId) : undefined;
    const step = f ? flowSteps(f, get().activeFlowIndex)[index] : undefined;
    set({ activeFindingId: findingId, activeStepIndex: index, activeFile: step?.file ?? get().activeFile, activeTab: 'code' });
  },

  step: (op) => {
    const c = get().content;
    const id = get().activeFindingId;
    const f = c && id ? findingById(c, id) : undefined;
    if (!f) return;
    const next = navigate(flowSteps(f, get().activeFlowIndex), get().activeStepIndex ?? 0, op);
    get().selectStep(f.id, next);
  },

  stepFlow: (op) => {
    const c = get().content;
    const id = get().activeFindingId;
    const f = c && id ? findingById(c, id) : undefined;
    if (!f) return;
    const last = f.flows.length - 1;
    const cur = Math.min(last, Math.max(0, get().activeFlowIndex));
    const nextIdx = op === 'next' ? Math.min(last, cur + 1) : Math.max(0, cur - 1);
    const steps = f.flows[nextIdx].steps;
    const sink = Math.max(0, steps.length - 1);
    set({ activeFlowIndex: nextIdx, activeStepIndex: sink, activeFile: steps[sink]?.file ?? get().activeFile });
  },
```

8. Persist the new field. In `type PersistedView` add `'activeFlowIndex'` to the `Pick<...>`; in `partialize` add `activeFlowIndex: s.activeFlowIndex,`; in `merge`, coerce it (final clamp happens in `loadContent` against the real finding):
```ts
      activeFlowIndex: Number.isInteger(p.activeFlowIndex) && (p.activeFlowIndex as number) >= 0 ? (p.activeFlowIndex as number) : 0,
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/state/store.test.ts` then `npm test`
Expected: PASS. `npx tsc --noEmit` passes.

- [ ] **Step 6: Commit**

```bash
git add src/content/loadContent.ts src/state/store.ts src/state/store.test.ts
git commit -m "feat: track and navigate the active code flow in the store"
```

---

## Task 5: CodeView — render the active flow + flow nav buttons

**Files:**
- Modify: `src/components/CodeView.tsx`
- Test: `src/components/CodeView.test.tsx`

- [ ] **Step 1: Write failing tests for the flow nav**

In `src/components/CodeView.test.tsx`, switch the helper off `steps` and add flow-button tests. Replace lines 30–33 with:

```ts
const active = content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!;
const activeSteps = active.flows[active.defaultFlowIndex].steps;
const activeFile = activeSteps[activeSteps.length - 1].file;
const decoCount = activeSteps.filter((s) => s.file === activeFile).length;
const tabBasenames = [...new Set(activeSteps.map((s) => s.file))].map((f) => f.split('/').pop()!);
const fileHead = content.files.find((f) => f.path === activeFile)!.content.slice(0, 20);
const multiFlow = content.findings.find((f) => f.flows.length > 1)!;
```
Then in the test on line 80, change `active.steps[active.steps.length - 1].label` to `activeSteps[activeSteps.length - 1].label`. Add:

```ts
  it('hides the flow nav for single-flow findings', () => {
    const single = content.findings.find((f) => f.flows.length === 1)!;
    useStore.getState().selectFinding(single.id);
    render(<CodeView />);
    expect(screen.queryByTestId('flow-nav')).toBeNull();
  });

  it('shows the flow nav and switches flows for multi-flow findings', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    useStore.getState().selectFinding(multiFlow.id);
    render(<CodeView />);
    expect(screen.getByTestId('flow-nav')).toBeInTheDocument();
    const before = useStore.getState().activeFlowIndex;
    const prevDisabled = before <= 0;
    await userEvent.click(screen.getByTestId(prevDisabled ? 'flow-next' : 'flow-prev'));
    expect(useStore.getState().activeFlowIndex).not.toBe(before);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/CodeView.test.tsx`
Expected: FAIL — no `flow-nav` test id; `active.flows` shape used.

- [ ] **Step 3: Implement CodeView changes**

In `src/components/CodeView.tsx`:

1. Add icons to the lucide import on line 2 (append `GitFork`):
```ts
import { SkipBack, ChevronsLeft, ChevronLeft, CornerLeftUp, ChevronRight, ChevronsRight, SkipForward, GitFork } from 'lucide-react';
```

2. Import `flowSteps`:
```ts
import { fileByPath, findingById, flowSteps } from '../content/loadContent';
```

3. Read the flow state and derive steps from it. Replace lines 22–39 region: add the selectors and replace `finding.steps` usages:
```ts
  const activeFlowIndex = useStore((s) => s.activeFlowIndex);
  const stepFlow = useStore((s) => s.stepFlow);
```
Then replace the derived values:
```ts
  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  const file = content && activeFile ? fileByPath(content, activeFile) : undefined;
  const steps = finding ? flowSteps(finding, activeFlowIndex) : [];
  const flowCount = finding?.flows.length ?? 0;
  const stepCount = steps.length;
  const cur = activeStepIndex ?? 0;
  const atStart = cur <= 0;
  const atEnd = cur >= stepCount - 1;

  const tabFiles = useMemo(() => {
    const set = new Set(steps.map((s) => s.file));
    if (activeFile) set.add(activeFile);
    return [...set];
  }, [steps, activeFile]);
```

4. In `revealCurrentStep` and `applyDecorations`, replace both `finding.steps` references with `steps`:
```ts
    const current = pathDecorations(steps, activeFile, cur).find((d) => d.isCurrent);
```
```ts
    const decos = pathDecorations(steps, activeFile, cur);
```

5. Add `activeFlowIndex` to the `applyDecorations` effect deps (line ~89):
```ts
  }, [activeFindingId, activeFile, activeStepIndex, activeFlowIndex]);
```

6. Add the flow nav group just inside the `{finding && (` block, before the existing `data-testid="step-nav"` div (around line 109):
```tsx
        {finding && flowCount > 1 && (
          <div data-testid="flow-nav" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 4px', flexShrink: 0, color: 'var(--fg-dim)' }}>
            <GitFork size={13} aria-hidden="true" />
            <button type="button" title="Previous flow" aria-label="Previous flow" data-testid="flow-prev" disabled={activeFlowIndex <= 0} onClick={() => stepFlow('prev')} style={navBtn}><ChevronLeft size={13} /></button>
            <span style={{ whiteSpace: 'nowrap', minWidth: '2ch', textAlign: 'center' }}>{activeFlowIndex + 1}/{flowCount}</span>
            <button type="button" title="Next flow" aria-label="Next flow" data-testid="flow-next" disabled={activeFlowIndex >= flowCount - 1} onClick={() => stepFlow('next')} style={navBtn}><ChevronRight size={13} /></button>
            <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '2px 4px' }} />
          </div>
        )}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/CodeView.test.tsx` then `npm test`
Expected: PASS. `npx tsc --noEmit` passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/CodeView.tsx src/components/CodeView.test.tsx
git commit -m "feat: flow prev/next buttons in the editor step-nav"
```

---

## Task 6: StepsList — render the active flow + multi-flow header

**Files:**
- Modify: `src/components/StepsList.tsx`
- Modify: `src/components/StepsList.module.css`
- Test: `src/components/StepsList.test.tsx`

- [ ] **Step 1: Write failing tests**

In `src/components/StepsList.test.tsx`, switch the helper off `steps` and add a header test. Replace lines 9–10 with:

```ts
const active = content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!;
const activeSteps = active.flows[active.defaultFlowIndex].steps;
const lastStep = activeSteps[activeSteps.length - 1];
```
Then replace the remaining `active.steps` references in the tests with `activeSteps`. Add:

```ts
  it('shows a flow header only for multi-flow findings', () => {
    const single = content.findings.find((f) => f.flows.length === 1)!;
    useStore.getState().selectFinding(single.id);
    const { unmount } = render(<StepsList />);
    expect(screen.queryByTestId('steps-flow-header')).toBeNull();
    unmount();

    const multi = content.findings.find((f) => f.flows.length > 1)!;
    useStore.getState().selectFinding(multi.id);
    render(<StepsList />);
    expect(screen.getByTestId('steps-flow-header')).toHaveTextContent(/Flow \d+ of \d+/);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/StepsList.test.tsx`
Expected: FAIL — no `steps-flow-header`; `active.flows` shape used.

- [ ] **Step 3: Implement StepsList changes**

Replace `src/components/StepsList.tsx` body to read the active flow and render the header. Update the imports and the component:

```ts
import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { findingById, flowSteps } from '../content/loadContent';
import { keyActivate } from './keyActivate';
import { SeverityBadge } from './SeverityBadge';
import { basename } from '../util/path';
import styles from './StepsList.module.css';

/** The active finding's taint path as a clickable, debugger-style step list. */
export function StepsList() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeFlowIndex = useStore((s) => s.activeFlowIndex);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const selectStep = useStore((s) => s.selectStep);
  const activeRef = useRef<HTMLLIElement>(null);
  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  const steps = finding ? flowSteps(finding, activeFlowIndex) : [];
  const flowCount = finding?.flows.length ?? 0;

  // Keep the current step visible as it changes (e.g. via next/prev or a finding click).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeFindingId, activeFlowIndex, activeStepIndex]);

  if (!finding) return null;

  return (
    <div className={styles.wrap}>
      {flowCount > 1 && (
        <div className={styles.flowHeader} data-testid="steps-flow-header">
          Flow {activeFlowIndex + 1} of {flowCount} · {steps.length} steps
        </div>
      )}
      <ol className={styles.steps} data-testid="steps-list">
        {steps.map((s) => {
          const isActive = activeStepIndex === s.index;
          return (
            <li
              key={s.index}
              ref={isActive ? activeRef : undefined}
              className={`${styles.step} ${isActive ? styles.active : ''}`}
              role="button"
              tabIndex={0}
              aria-current={isActive}
              onClick={() => selectStep(finding.id, s.index)}
              onKeyDown={keyActivate(() => selectStep(finding.id, s.index))}
            >
              <div className={styles.row}>
                <span className={styles.marker}>{s.index + 1}</span>
                {s.kind === 'sink' && <SeverityBadge severity={finding.severity} />}
                <span className={styles.loc}>
                  {basename(s.file)}:{s.line}
                  {s.crossesFile ? ' ↗' : ''}
                </span>
              </div>
              <div className={styles.label}>{s.label}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Add the header styles**

In `src/components/StepsList.module.css`, add a wrapper that lets the list scroll under a fixed header, and the header style. Change `.steps { … height: 100%; overflow: auto; }` to drop `height: 100%` (the wrapper owns height) and add:

```css
.wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.steps { list-style: none; margin: 0; padding: 6px 0; font-size: 12px; flex: 1; min-height: 0; overflow: auto; }
.flowHeader {
  flex-shrink: 0; padding: 5px 10px; border-bottom: 1px solid var(--border);
  color: var(--fg-dim); font-family: var(--mono); font-size: 10px;
}
```
(Replace the existing `.steps` line with the new one; keep the other rules.)

- [ ] **Step 5: Run tests**

Run: `npm test -- src/components/StepsList.test.tsx` then `npm test`
Expected: PASS. `npx tsc --noEmit` passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/StepsList.tsx src/components/StepsList.module.css src/components/StepsList.test.tsx
git commit -m "feat: show the active flow and a flow header in the steps list"
```

---

## Task 7: Remove the derived `steps` field

**Files:**
- Modify: `src/types/content.ts`
- Modify: `src/pipeline/sarif.ts`
- Modify: `src/pipeline/sarif.test.ts`
- Modify: `scripts/regen-content.ts`
- Modify: `src/content/java-spring-demo.json` (regenerated)

- [ ] **Step 1: Drop `steps` from the `Finding` type**

In `src/types/content.ts`, remove the `steps: TaintStep[];` line from the `Finding` interface. Keep `TaintStep` (still used by `Flow`).

- [ ] **Step 2: Stop emitting `steps` in the transform**

In `src/pipeline/sarif.ts` `buildFinding`, remove the line:
```ts
    steps: flows[defaultFlowIndex].steps, // derived; removed in Task 7
```
In `src/pipeline/sarif.test.ts`, delete two now-obsolete tests, both of which assert on `finding.steps`:
- the `it('keeps `steps` as the default flow …')` test added in Task 1, and
- the pre-existing `describe('transformSarif codeFlow selection', …)` block (its "picks the longest flow" behavior is covered by the `defaults to the longest flow` test added in Task 1).

- [ ] **Step 3: Use the default flow in regen scenario building**

In `scripts/regen-content.ts` `buildScenarios`, change line ~119:
```ts
      startFile: f.flows[f.defaultFlowIndex].steps[0]?.file ?? '',
```

- [ ] **Step 4: Verify the type-check fails only where expected, then regenerate**

Run: `npx tsc --noEmit`
Expected: errors ONLY if a `.steps` reference on a `Finding` remains. There should be none (all consumers migrated in Tasks 4–6). If any appear, fix them to use `flowSteps`/`flows[...]`.

Run: `npm run regen`
Expected: `Wrote src/content/java-spring-demo.json: 13 findings, 23 files, 47 rules, 3 scenarios`, and the JSON no longer contains a top-level `steps` per finding.

Run: `node -e "const c=require('./src/content/java-spring-demo.json'); console.log('has steps field:', 'steps' in c.findings[0]);"`
Expected: `has steps field: false`.

- [ ] **Step 5: Run the full suite + type-check**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/content.ts src/pipeline/sarif.ts src/pipeline/sarif.test.ts scripts/regen-content.ts src/content/java-spring-demo.json
git commit -m "refactor: drop the derived steps field; flows is the single source"
```

---

## Task 8: e2e — migrate off `steps` and assert flow switching

**Files:**
- Modify: `e2e/playground.spec.ts`

- [ ] **Step 1: Update the content types and helpers off `steps`**

In `e2e/playground.spec.ts`, replace the interfaces and derived helpers (lines 5–16) with:

```ts
interface Step { file: string; label: string }
interface Flow { steps: Step[] }
interface Finding { id: string; ruleId: string; vulnClass: string; location: string; flows: Flow[]; defaultFlowIndex: number }
interface Content { scenarios: { defaultFindingId: string; startFile: string }[]; findings: Finding[] }

const content: Content = JSON.parse(readFileSync('src/content/java-spring-demo.json', 'utf8'));
const scenario = content.scenarios[0];
const active = content.findings.find((f) => f.id === scenario.defaultFindingId)!;
const activeSteps = active.flows[active.defaultFlowIndex].steps;
const location = active.location;
const startBase = scenario.startFile.split('/').pop()!;
const lastStep = activeSteps[activeSteps.length - 1];
const sinkBase = lastStep.file.split('/').pop()!;
const stepText = lastStep.label.slice(0, 30);

// The stored-XSS finding with two flows; used to exercise the flow picker.
const multiFlow = content.findings.find((f) => f.flows.length > 1 && f.location === 'MessageController.java:96')!;
const otherFlowIndex = multiFlow.defaultFlowIndex === 0 ? 1 : 0;
// A step label present in the default flow but not in the other flow (proves the switch changed the path).
const defaultOnlyLabel = multiFlow.flows[multiFlow.defaultFlowIndex].steps
  .map((s) => s.label)
  .find((l) => !multiFlow.flows[otherFlowIndex].steps.some((s) => s.label === l))!;
```

- [ ] **Step 2: Add the flow-switch test**

Append to `e2e/playground.spec.ts`:

```ts
test('switching code flow on MessageController.java:96 changes the taint path', async ({ page }) => {
  await page.goto('/');

  // Open the stored-XSS finding (two flows). Its location is unique to the finding row.
  await page.getByTestId('findings-tree').getByText(multiFlow.location).click();

  // Show the Steps list and the flow header (multi-flow only).
  await page.getByTestId('info-tab-steps').click();
  await expect(page.getByTestId('steps-flow-header')).toContainText('of 2');

  // The default flow shows a step the other flow does not.
  await expect(page.getByTestId('steps-list').getByText(defaultOnlyLabel.slice(0, 30)).first()).toBeVisible();

  // Switch flows via the editor nav; the default-only step disappears.
  const prev = page.getByTestId('flow-prev');
  const next = page.getByTestId('flow-next');
  await (multiFlow.defaultFlowIndex === 0 ? next : prev).click();
  await expect(page.getByTestId('steps-flow-header')).toContainText(`Flow ${otherFlowIndex + 1} of 2`);
  await expect(page.getByTestId('steps-list').getByText(defaultOnlyLabel.slice(0, 30))).toHaveCount(0);
});
```

- [ ] **Step 3: Run the e2e suite**

Run: `npm run e2e`
Expected: PASS (all prior tests plus the new flow-switch test). If Playwright browsers are missing: `npx playwright install --with-deps chromium` first.

- [ ] **Step 4: Commit**

```bash
git add e2e/playground.spec.ts
git commit -m "test: e2e flow switching on the stored-XSS finding"
```

---

## Final verification

- [ ] Run `npx tsc --noEmit` — passes.
- [ ] Run `npm run coverage` — passes; coverage not regressed.
- [ ] Run `npm run e2e` — passes.
- [ ] Run `npm run build` — passes.
- [ ] Manual smoke (`npm run dev`): open `MessageController.java:96`, confirm the editor step-nav shows `⑂ ‹ 2/2 ›`, the default trace is the 26-step stored-XSS flow, and prev/next switches to the 10-step flow and back.
