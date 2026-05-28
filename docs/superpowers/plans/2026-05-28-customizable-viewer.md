# Customizable Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the viewer generic — driven by a committed `data/content.json` generated from a SARIF + source dir + rules dir via one command, deployable as-is or as one offline HTML — and surface the analyzer/version from the SARIF.

**Architecture:** Remove the curation layer (scenarios, blurbs, flow overrides). A new `scripts/gen-content.ts` produces `data/content.json` = `{projectId, tool, files(pruned to referenced), rules(all), findings}`. The store's default focus becomes `findings[0]`. The TopBar shows the analyzer version. The committed default content is the regenerated `java-spring-demo`.

**Tech Stack:** TypeScript, React 18, Zustand, Vite, Vitest + Testing Library, Playwright, tsx.

**Spec:** `docs/superpowers/specs/2026-05-28-customizable-viewer-design.md`

**Key facts the engineer needs:**
- `loadContent` validates the committed JSON with `isViewerContent` at load, and *many* tests call `loadContent()` — so the committed JSON must satisfy the guard after every task. That dictates ordering (relax guard → regenerate → switch loader).
- For the demo, `content.findings[0]` is the same finding scenarios used as the default (`java.security.ssti-0`), and the longest-flow default for `MessageController.java:96` equals the old curated override (flow 1) — so removing scenarios/overrides causes **no behavioral change** for the demo's default view.
- The real SARIF (`java-spring-demo/results.sarif`, on disk, gitignored) has `tool.driver.name="OpenTaint"`, `semanticVersion="0.3.0"`, `version="analyzer/2026.05.15.f15ed3a"`. The fixture (`fixtures/sample.sarif`) has none → version display must degrade.
- `gen` runs offline against the on-disk demo inputs; no Docker.

---

## Task 1: Transform — longest-only default flow + `toolInfo` extractor

**Files:**
- Modify: `src/types/content.ts` (add `ToolInfo`)
- Modify: `src/pipeline/sarif.ts`
- Test: `src/pipeline/sarif.test.ts`

- [ ] **Step 1: Add the `ToolInfo` type**

In `src/types/content.ts`, add after the `RuleOrigin`/`Language` type aliases near the top (before `TaintStep`):
```ts
export interface ToolInfo {
  /** Analyzer name from the SARIF driver, e.g. "OpenTaint". */
  name: string;
  /** SARIF driver.semanticVersion, e.g. "0.3.0". */
  semanticVersion?: string;
  /** SARIF driver.version, e.g. "analyzer/2026.05.15.f15ed3a". */
  version?: string;
}
```

- [ ] **Step 2: Write failing tests for `toolInfo` and longest-only default**

In `src/pipeline/sarif.test.ts`, **delete** the `it('the curated override for MessageController.java:96 beats the longest-flow heuristic', …)` test (the override is being removed). Change the import line to include `toolInfo`:
```ts
import { transformSarif, vulnClassForRule, toolInfo } from './sarif';
```
Append a new describe block:
```ts
describe('toolInfo', () => {
  it('reads name, semanticVersion and version from the SARIF driver', () => {
    const log = { runs: [{ tool: { driver: { name: 'OpenTaint', semanticVersion: '0.3.0', version: 'analyzer/abc' } } }] };
    expect(toolInfo(log)).toEqual({ name: 'OpenTaint', semanticVersion: '0.3.0', version: 'analyzer/abc' });
  });

  it('defaults the name and leaves versions undefined when the driver omits them', () => {
    expect(toolInfo({ runs: [{ tool: { driver: {} } }] })).toEqual({ name: 'OpenTaint', semanticVersion: undefined, version: undefined });
    expect(toolInfo({})).toEqual({ name: 'OpenTaint', semanticVersion: undefined, version: undefined });
  });
});
```

- [ ] **Step 3: Run tests, verify failure**

Run: `npm test -- src/pipeline/sarif.test.ts`
Expected: FAIL — `toolInfo` is not exported.

- [ ] **Step 4: Implement in `src/pipeline/sarif.ts`**

1. Add `ToolInfo` to the type import on line 1:
```ts
import type { Finding, Flow, Severity, TaintStep, ToolInfo } from '../types/content';
```
2. Extend the `SarifLog` interface's driver type (add name/version/semanticVersion):
```ts
interface SarifLog {
  runs?: Array<{ results?: SarifResult[]; tool?: { driver?: { rules?: SarifRule[]; name?: string; version?: string; semanticVersion?: string } } }>;
}
```
3. Delete `DEFAULT_FLOW_OVERRIDES` and replace `pickDefaultFlow` with:
```ts
function longestFlowIndex(flows: Flow[]): number {
  let best = 0; // longest flow wins; ties resolve to the lowest index
  for (let i = 1; i < flows.length; i++) if (flows[i].steps.length > flows[best].steps.length) best = i;
  return best;
}
```
4. In `buildFinding`: delete the two lines `const location = primaryLocation(res);` and `const defaultFlowIndex = pickDefaultFlow(ruleId, location, flows);`; add `const defaultFlowIndex = longestFlowIndex(flows);`. In the returned object, change the field `location,` to `location: primaryLocation(res),` so it no longer references the removed `const` (the `location` Finding field is still populated).
5. Add the extractor (e.g. after `transformSarif`):
```ts
export function toolInfo(log: SarifLog): ToolInfo {
  const d = log.runs?.[0]?.tool?.driver;
  return { name: d?.name ?? 'OpenTaint', semanticVersion: d?.semanticVersion, version: d?.version };
}
```

- [ ] **Step 5: Run full suite + type-check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. (The committed JSON's baked `defaultFlowIndex` is unchanged; longest == old override for the demo.)

- [ ] **Step 6: Commit**
```bash
git add src/types/content.ts src/pipeline/sarif.ts src/pipeline/sarif.test.ts
git commit -m "feat: longest-flow default + SARIF toolInfo extractor; drop curated override"
```

---

## Task 2: Decouple tests from `scenarios` (test-only)

**Files:**
- Modify: `src/App.test.tsx`, `src/components/StepsList.test.tsx`, `src/components/FindingsTree.test.tsx`, `src/components/FindingInfo.test.tsx`, `src/components/CodeView.test.tsx`

These five test files derive the default finding via `content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!`. The store's new default will be `content.findings[0]` (the same finding for the demo), so retarget the helpers now to decouple them from `scenarios` before it's removed.

- [ ] **Step 1: Update each helper**

In each of the five files, replace:
```ts
content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!
```
with:
```ts
content.findings[0]
```
(In `FindingInfo.test.tsx` the variable is `finding`, others `active` — keep the variable name, change only the right-hand side.)

- [ ] **Step 2: Run the affected suites, verify still green**

Run: `npm test -- src/App.test.tsx src/components/StepsList.test.tsx src/components/FindingsTree.test.tsx src/components/FindingInfo.test.tsx src/components/CodeView.test.tsx`
Expected: PASS — `findings[0]` is the same finding the scenario pointed to. If any fail, STOP: it means `findings[0]` ≠ the scenario default for the committed content; reconcile before continuing.

- [ ] **Step 3: Commit**
```bash
git add src/App.test.tsx src/components/StepsList.test.tsx src/components/FindingsTree.test.tsx src/components/FindingInfo.test.tsx src/components/CodeView.test.tsx
git commit -m "test: derive default finding from findings[0] instead of scenarios"
```

---

## Task 3: Remove `scenarios`; add `tool`; default focus = `findings[0]`

**Files:**
- Modify: `src/types/content.ts`
- Modify: `src/state/store.ts`
- Test: `src/types/content.test.ts`, `src/state/store.test.ts`

- [ ] **Step 1: Update `src/types/content.ts`**

Delete the `Scenario` interface. In `ViewerContent`, remove `scenarios: Scenario[];` and add `tool?: ToolInfo;`:
```ts
export interface ViewerContent {
  projectId: string;
  tool?: ToolInfo;
  files: ProjectFile[];
  rules: RuleSpec[];
  findings: Finding[];
}
```
Replace `isViewerContent` with (drops the scenarios requirement; validates `tool` shape only when present):
```ts
export function isViewerContent(value: unknown): value is ViewerContent {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  if (
    typeof c.projectId !== 'string' ||
    !Array.isArray(c.files) ||
    !Array.isArray(c.findings) ||
    !Array.isArray(c.rules)
  ) {
    return false;
  }
  if (c.tool !== undefined) {
    const t = c.tool as Record<string, unknown> | null;
    if (typeof t !== 'object' || t === null || typeof t.name !== 'string') return false;
  }
  return (c.findings as unknown[]).every((f) => {
    if (typeof f !== 'object' || f === null) return false;
    const finding = f as Record<string, unknown>;
    const flows = finding.flows;
    const idx = finding.defaultFlowIndex;
    return (
      Array.isArray(flows) && flows.length > 0 &&
      typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < flows.length
    );
  });
}
```

- [ ] **Step 2: Update `src/types/content.test.ts`**

In the valid object, remove the `scenarios: [...]` line and add a `tool`:
```ts
      projectId: 'java-spring-demo',
      tool: { name: 'OpenTaint', semanticVersion: '0.3.0' },
      files: [{ path: 'A.java', language: 'java', content: '...' }],
      findings: [{ id: 'f1', ruleId: 'sqli', vulnClass: 'SQL Injection', severity: 'error', endpoint: null, message: 'm', flows: [{ steps: [] }], defaultFlowIndex: 0 }],
      rules: [{ id: 'sqli', origin: 'builtin', kind: 'rule', path: 'Builtin/rule/sqli.yaml', content: 'id: sqli' }],
```
Add a rejection case for a malformed tool (append inside the describe):
```ts
  it('rejects a malformed tool', () => {
    const base = { projectId: 'p', files: [], rules: [], findings: [] };
    expect(isViewerContent({ ...base, tool: { semanticVersion: '1.0.0' } })).toBe(false); // no name
    expect(isViewerContent({ ...base, tool: 'x' })).toBe(false);
    expect(isViewerContent(base)).toBe(true); // tool omitted is allowed
  });
```

- [ ] **Step 3: Update `src/state/store.ts`**

- Remove `scenarioId: string | null;` from `interface State`.
- Remove `selectScenario: (id: string) => void;` from `interface Actions`.
- In `const initial`, remove `scenarioId: null,`.
- In `type PersistedView = Pick<State, …>`, remove `'scenarioId'`.
- In `partialize`, remove the `scenarioId: s.scenarioId,` line.
- Replace `defaultFocus` with:
```ts
/** Default focus: the first finding, its default flow, on the sink. */
function defaultFocus(content: ViewerContent) {
  const finding = content.findings[0] ?? null;
  const flowIndex = finding?.defaultFlowIndex ?? 0;
  const steps = finding ? flowSteps(finding, flowIndex) : [];
  const lastIdx = steps.length ? steps.length - 1 : null;
  return {
    activeFindingId: finding?.id ?? null,
    activeFlowIndex: flowIndex,
    activeStepIndex: lastIdx,
    activeFile: steps[lastIdx ?? 0]?.file ?? null,
    activeRuleId: content.rules[0]?.id ?? null,
  };
}
```
- In the `loadContent` action, remove the `const scenarioOk = …` line and the `scenarioId: scenarioOk ? … ` line from the `set({…})` call (delete only those two; keep everything else).
- Delete the entire `selectScenario: (id) => { … },` action implementation.

- [ ] **Step 4: Update `src/state/store.test.ts`**

- Remove line `const scenario = content.scenarios[0];`.
- In the first test (`loadContent selects … the sink`), remove the `expect(s.scenarioId).toBe(scenario.id);` assertion and any other `scenario`/`scenarioId` references; derive the default finding as `const defaultFinding = content.findings[0];` and assert against it (it already asserts `activeFindingId`/`activeStepIndex`/`activeFile` — point them at `content.findings[0]`).
- Remove any test that asserts `selectScenario`/`scenarioId` behavior (if present). Keep all flow/step/rule tests.

- [ ] **Step 5: Run full suite + type-check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. The committed `java-spring-demo.json` still has a `scenarios` field (now ignored) and no `tool` (allowed) — guard passes; default focus now uses `findings[0]` (same finding).

- [ ] **Step 6: Commit**
```bash
git add src/types/content.ts src/state/store.ts src/types/content.test.ts src/state/store.test.ts
git commit -m "feat: drop scenarios from the model; tool metadata; default focus = findings[0]"
```

---

## Task 4: `gen-content.ts` generator + unit test

**Files:**
- Create: `scripts/gen-content.ts`
- Test: `scripts/gen-content.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/gen-content.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

// Minimal opentaint-style SARIF: one finding referencing A.java (B.java is unreferenced).
const sarif = {
  runs: [{
    tool: { driver: { name: 'OpenTaint', semanticVersion: '9.9.9', version: 'analyzer/test', rules: [] } },
    results: [{
      ruleId: 'java.security.xss-in-spring-app', level: 'error', message: { text: 'm' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 2 } } }],
      codeFlows: [{ threadFlows: [{ locations: [
        { location: { physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 1 } }, message: { text: 'source' } }, kinds: ['taint'] },
        { location: { physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 2 } }, message: { text: 'sink' } }, kinds: ['taint'] },
      ] }] }],
    }],
  }],
};

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gen-'));
  mkdirSync(join(dir, 'proj', 'src'), { recursive: true });
  mkdirSync(join(dir, 'rules'), { recursive: true });
  writeFileSync(join(dir, 'proj', 'src', 'A.java'), 'class A {}');
  writeFileSync(join(dir, 'proj', 'src', 'B.java'), 'class B {}'); // unreferenced -> pruned
  writeFileSync(join(dir, 'rules', 'xss.yaml'), 'id: xss-in-spring-app\n');
  writeFileSync(join(dir, 'rules', 'other.yaml'), 'id: other\n'); // unreferenced -> still kept
  writeFileSync(join(dir, 'report.sarif'), JSON.stringify(sarif));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('gen-content', () => {
  it('generates pruned content with tool info and rule links', () => {
    const out = join(dir, 'content.json');
    execFileSync('npx', ['tsx', 'scripts/gen-content.ts',
      '--sarif', join(dir, 'report.sarif'),
      '--src', join(dir, 'proj', 'src'),
      '--rules', join(dir, 'rules'),
      '--name', 'demo', '--out', out,
    ], { stdio: 'pipe' });
    const c = JSON.parse(readFileSync(out, 'utf8'));

    expect(c.projectId).toBe('demo');
    expect(c.tool).toEqual({ name: 'OpenTaint', semanticVersion: '9.9.9', version: 'analyzer/test' });
    // Sources pruned to referenced (A.java kept, B.java dropped).
    expect(c.files.map((f: { path: string }) => f.path)).toEqual(['src/A.java']);
    // All rules kept (both yaml files), even unreferenced ones.
    expect(c.rules.map((r: { path: string }) => r.path).sort()).toEqual(['other.yaml', 'xss.yaml']);
    // Finding links to the rule file by id.
    expect(c.findings[0].ruleFile).toBe('xss.yaml');
    expect(c.findings).toHaveLength(1);
    expect(typeof c.findings[0].defaultFlowIndex).toBe('number');
    expect('scenarios' in c).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test -- scripts/gen-content.test.ts`
Expected: FAIL — `scripts/gen-content.ts` does not exist.

- [ ] **Step 3: Create `scripts/gen-content.ts`**

```ts
/**
 * Generates the viewer content folder (data/content.json) from an existing analysis.
 *
 * Usage:
 *   tsx scripts/gen-content.ts --sarif <file> --src <dir> --rules <dir> [--name <id>] [--root <dir>] [--out <file>]
 *
 * You produce the SARIF yourself by running the analyzer. Inputs:
 *   --sarif  SARIF report
 *   --src    source dir (files are pruned to those a finding references)
 *   --rules  ruleset dir (the full ruleset is included)
 *   --name   projectId (default: basename of --src)
 *   --root   base the SARIF artifact URIs are relative to (default: dirname(--src))
 *   --out    output file (default: data/content.json)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, extname, basename, dirname, resolve } from 'node:path';
import { transformSarif, toolInfo } from '../src/pipeline/sarif';
import { isViewerContent } from '../src/types/content';
import type { Finding, Language, ProjectFile, RuleSpec } from '../src/types/content';

const LANG_BY_EXT: Record<string, Language> = {
  '.java': 'java', '.kt': 'kotlin', '.yml': 'yaml', '.yaml': 'yaml', '.xml': 'xml', '.properties': 'properties',
};

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  return args;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'build' || name === '.gradle') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function collectFiles(srcDir: string, root: string, referenced: Set<string>): ProjectFile[] {
  return walk(srcDir)
    .filter((p) => LANG_BY_EXT[extname(p)])
    .map((p) => ({ path: relative(root, p), language: LANG_BY_EXT[extname(p)] ?? 'plaintext', content: readFileSync(p, 'utf8') }))
    .filter((f) => referenced.has(f.path));
}

function readRules(rulesDir: string): RuleSpec[] {
  return walk(rulesDir)
    .filter((p) => extname(p) === '.yaml' || extname(p) === '.yml')
    .map((p) => relative(rulesDir, p))
    .sort()
    .map((path) => ({ id: path, origin: 'builtin' as const, path, content: readFileSync(join(rulesDir, path), 'utf8') }));
}

function buildRuleIndex(rules: RuleSpec[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const rule of rules) for (const m of rule.content.matchAll(/\bid:\s*([A-Za-z0-9._-]+)/g)) if (!index.has(m[1])) index.set(m[1], rule.path);
  return index;
}

function ruleFileFor(ruleId: string, index: Map<string, string>): string | null {
  const bare = ruleId.replace(/^java\.[a-z]+\./, '');
  return index.get(bare) ?? index.get(ruleId) ?? null;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sarifPath = args.sarif, srcArg = args.src, rulesArg = args.rules;
  if (!sarifPath || !srcArg || !rulesArg) {
    console.error('Usage: tsx scripts/gen-content.ts --sarif <file> --src <dir> --rules <dir> [--name <id>] [--root <dir>] [--out <file>]');
    process.exit(1);
  }
  for (const [flag, p] of [['--sarif', sarifPath], ['--src', srcArg], ['--rules', rulesArg]] as const) {
    if (!existsSync(p)) { console.error(`${flag} path not found: ${p}`); process.exit(1); }
  }
  const srcDir = resolve(srcArg);
  const root = resolve(args.root ?? dirname(srcDir));
  const out = args.out ?? 'data/content.json';
  const projectId = args.name ?? basename(srcDir);

  const sarif = JSON.parse(readFileSync(sarifPath, 'utf8'));
  const rules = readRules(resolve(rulesArg));
  const index = buildRuleIndex(rules);
  const findings: Finding[] = transformSarif(sarif).map((f) => ({ ...f, ruleFile: ruleFileFor(f.ruleId, index) }));
  const referenced = new Set(findings.flatMap((f) => f.flows.flatMap((fl) => fl.steps.map((s) => s.file))));
  const files = collectFiles(srcDir, root, referenced);
  const tool = toolInfo(sarif);

  const content = { projectId, tool, files, rules, findings };
  if (!isViewerContent(content)) throw new Error('Generated content failed contract validation');
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, JSON.stringify(content, null, 2));
  console.log(`Wrote ${out}: ${findings.length} findings, ${files.length} files, ${rules.length} rules`);
}

try {
  main();
} catch (error) {
  console.error('gen-content failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
```

- [ ] **Step 4: Run the test + type-check**

Run: `npm test -- scripts/gen-content.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/gen-content.ts scripts/gen-content.test.ts
git commit -m "feat: generic gen-content CLI (SARIF + src + rules -> content.json)"
```

---

## Task 5: TopBar analyzer-version chip

**Files:**
- Modify: `src/components/TopBar.tsx`, `src/components/TopBar.module.css`
- Test: `src/components/TopBar.test.tsx`

- [ ] **Step 1: Write failing tests**

In `src/components/TopBar.test.tsx`, add `import { useStore } from '../state/store';` and a `beforeEach(() => useStore.setState({ content: null }));`. Append:
```ts
  it('shows the semver version chip with the analyzer build in its title', () => {
    useStore.setState({ content: { projectId: 'p', tool: { name: 'OpenTaint', semanticVersion: '0.3.0', version: 'analyzer/abc' }, files: [], rules: [], findings: [] } });
    render(<TopBar />);
    const chip = screen.getByTestId('tool-version');
    expect(chip).toHaveTextContent('v0.3.0');
    expect(chip).toHaveAttribute('title', expect.stringContaining('analyzer/abc'));
  });

  it('renders no version chip when the content has no tool versions', () => {
    useStore.setState({ content: { projectId: 'p', tool: { name: 'OpenTaint' }, files: [], rules: [], findings: [] } });
    render(<TopBar />);
    expect(screen.queryByTestId('tool-version')).toBeNull();
  });
```
(Cast the `content` object with `as never` if TS complains about partial finding/rule shapes in the test.)

- [ ] **Step 2: Run, verify failure**

Run: `npm test -- src/components/TopBar.test.tsx`
Expected: FAIL — no `tool-version` element.

- [ ] **Step 3: Implement in `src/components/TopBar.tsx`**

Add the store import and the chip. New file body:
```tsx
import { Star, Terminal } from 'lucide-react';
import { useTheme } from '../state/theme';
import { useStore } from '../state/store';
import logoLight from '../assets/opentaint-header-light.svg';
import logoDark from '../assets/opentaint-header-dark.svg';
import styles from './TopBar.module.css';

const SITE_URL = 'https://opentaint.org/';
const REPO_URL = 'https://github.com/seqra/opentaint';
const QUICKSTART_URL = 'https://github.com/seqra/opentaint#quick-start';

export function TopBar() {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const tool = useStore((s) => s.content?.tool);
  const label = tool?.semanticVersion ? `v${tool.semanticVersion}` : tool?.version;

  return (
    <div className={styles.bar} data-testid="top-bar">
      <a className={styles.brand} href={SITE_URL} target="_blank" rel="noreferrer">
        <img className={styles.logo} src={theme === 'dark' ? logoDark : logoLight} alt="OpenTaint" width={141} height={26} />
      </a>
      {label && (
        <span className={styles.version} data-testid="tool-version" title={`${tool?.name ?? ''}${tool?.version ? ' ' + tool.version : ''}`.trim()}>
          {label}
        </span>
      )}
      <span className={styles.grow} />
      <button className={styles.pill} aria-label="Toggle theme" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <a className={styles.star} href={REPO_URL} target="_blank" rel="noreferrer">
        <Star size={14} aria-hidden="true" /> Star
      </a>
      <a className={styles.cta} href={QUICKSTART_URL} target="_blank" rel="noreferrer">
        <Terminal size={14} aria-hidden="true" /> Install
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Add the style**

In `src/components/TopBar.module.css`, append:
```css
.version { flex: none; color: var(--fg-dim); font-size: 11px; font-family: var(--mono); }
```

- [ ] **Step 5: Run full suite + type-check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. (In the running app the committed JSON has no `tool` yet, so the chip is hidden until Task 6 regenerates content.)

- [ ] **Step 6: Commit**
```bash
git add src/components/TopBar.tsx src/components/TopBar.module.css src/components/TopBar.test.tsx
git commit -m "feat: show analyzer semver in the top bar (build string on hover)"
```

---

## Task 6: Regenerate `data/content.json`; switch loader; retire old files

**Files:**
- Create: `data/content.json` (generated)
- Modify: `src/content/loadContent.ts`, `package.json`
- Delete: `src/content/java-spring-demo.json`, `scripts/regen-content.ts`
- Rename/Modify: `src/content/java-spring-demo.test.ts` → `src/content/content-contract.test.ts`

- [ ] **Step 1: Update `package.json` script**

Replace the `"regen"` script line with:
```json
    "gen": "tsx scripts/gen-content.ts",
```

- [ ] **Step 2: Generate the committed default content** (do this before switching the import, so `data/content.json` exists)

Run (offline, against the on-disk demo inputs):
```bash
npm run gen -- --sarif java-spring-demo/results.sarif --src java-spring-demo/src --rules .opentaint-rules --name java-spring-demo --out data/content.json
```
Expected: `Wrote data/content.json: 13 findings, N files, 47 rules` (N < 23 — sources pruned to referenced).
Verify shape:
```bash
node -e "const c=require('./data/content.json'); console.log('tool', c.tool, '| files', c.files.length, '| rules', c.rules.length, '| scenarios?', 'scenarios' in c); const f=c.findings.find(x=>x.location&&x.location.includes('MessageController.java:96')); console.log(':96 default', f.defaultFlowIndex, 'len', f.flows[f.defaultFlowIndex].steps.length);"
```
Expected: `tool { name: 'OpenTaint', semanticVersion: '0.3.0', version: 'analyzer/2026.05.15.f15ed3a' }`, `rules 47`, `scenarios? false`, `:96 default 1 len 26`.

- [ ] **Step 3: Switch the loader import**

In `src/content/loadContent.ts`, change line 1:
```ts
import raw from '../../data/content.json';
```

- [ ] **Step 4: Delete the old content + generator**
```bash
git rm src/content/java-spring-demo.json scripts/regen-content.ts
```

- [ ] **Step 5: Retarget the content-contract test**

`git mv src/content/java-spring-demo.test.ts src/content/content-contract.test.ts`, then edit it:
- Change the import to `import content from '../../data/content.json';`.
- **Delete** the `it('every scenario references an existing finding and file', …)` test (scenarios are gone).
- Keep the contract test (`isViewerContent(content)` true), the `every taint step references an existing file` test (iterates `f.flows[].steps[]`), and the `every finding's ruleId is locatable` test.

- [ ] **Step 6: Run full suite + type-check + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: PASS. `loadContent.test.ts` still passes (`projectId === 'java-spring-demo'` via `--name`; files/rules > 0). If a stray `scenarios` reference remains anywhere, fix it (use `findings[0]`).

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "chore: move content to data/content.json (generated, pruned, no scenarios); retire regen"
```

---

## Task 7: e2e — derive from `findings[0]`, assert the version chip

**Files:**
- Modify: `e2e/playground.spec.ts`

- [ ] **Step 1: Update the content interface + helpers**

Replace the interfaces/derivation block (top of file) with:
```ts
interface Step { file: string; label: string }
interface Flow { steps: Step[] }
interface Finding { id: string; ruleId: string; vulnClass: string; location: string; flows: Flow[]; defaultFlowIndex: number }
interface Content { findings: Finding[] }

const content: Content = JSON.parse(readFileSync('data/content.json', 'utf8'));
const active = content.findings[0];
const activeSteps = active.flows[active.defaultFlowIndex].steps;
const location = active.location;
const lastStep = activeSteps[activeSteps.length - 1];
const sinkBase = lastStep.file.split('/').pop()!;
const stepText = lastStep.label.slice(0, 30);

const multiFlow = content.findings.find((f) => f.flows.length > 1 && f.location === 'MessageController.java:96')!;
const otherFlowIndex = multiFlow.defaultFlowIndex === 0 ? 1 : 0;
const defaultOnlyLabel = multiFlow.flows[multiFlow.defaultFlowIndex].steps
  .map((s) => s.label)
  .find((l) => !multiFlow.flows[otherFlowIndex].steps.some((s) => s.label === l))!;
```

- [ ] **Step 2: Fix the first test (no more `scenario.startFile`)**

In the first test (`explore a finding, jump cross-file, and split`), replace the `startBase` tab assertion with `sinkBase` (on load the editor opens the default finding's sink file):
```ts
  await expect(page.getByTestId('findings-tree').getByText(location)).toBeVisible();
  await expect(page.getByRole('tab', { name: sinkBase })).toBeVisible();
  await page.getByTestId('info-tab-steps').click();
  await page.getByTestId('steps-list').getByText(stepText).first().click();
  await expect(page.getByRole('tab', { name: sinkBase })).toHaveAttribute('aria-selected', 'true');
```
(Remove the now-undefined `startBase` line.)

- [ ] **Step 3: Add a version-chip assertion**

Append a test:
```ts
test('shows the analyzer version from the SARIF in the top bar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('top-bar').getByTestId('tool-version')).toBeVisible();
});
```

- [ ] **Step 4: Run e2e**

Run: `npm run e2e`
Expected: PASS (all tests, including the flow-switch and version-chip tests). If browsers are missing: `npx playwright install chromium` first.

- [ ] **Step 5: Commit**
```bash
git add e2e/playground.spec.ts
git commit -m "test: e2e drives off findings[0]; assert analyzer version chip"
```

---

## Task 8: Document the workflow

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Replace the "Regenerating content" section (and any `npm run regen` mention) with a section documenting the three-step workflow:
```markdown
## Customizing for your own project

The viewer renders a single committed `data/content.json`. To point it at another project:

1. **Produce a SARIF** by running OpenTaint on your project (see the OpenTaint CLI).
2. **Generate the content folder** (one command):
   ```bash
   npm run gen -- --sarif <report.sarif> --src <source-dir> --rules <rules-dir> [--name <project-id>]
   ```
   This writes `data/content.json` — findings + the source files they reference (pruned) +
   the full ruleset + the analyzer version from the SARIF.
3. **Deploy** (`npm run build` → `dist/`) or **build a fully-offline single HTML**
   (`npm run build:single` → `dist-single/index.html`).
```
Also update the "Scripts" table: replace the `regen` row with `gen` (described above).

- [ ] **Step 2: Commit**
```bash
git add README.md
git commit -m "docs: document the gen -> build/build:single customization workflow"
```

---

## Final verification

- [ ] `npx tsc --noEmit` — passes.
- [ ] `npm run coverage` — passes.
- [ ] `npm run e2e` — passes.
- [ ] `npm run build && npm run build:single` — both pass.
- [ ] Manual smoke (`npm run dev`): the top bar shows `v0.3.0` (hover → `OpenTaint analyzer/2026.05.15.f15ed3a`); the Rules tab still lists the full ruleset; the editor opens the first finding on load.
- [ ] Sanity re-gen for an arbitrary project is documented in the README.
