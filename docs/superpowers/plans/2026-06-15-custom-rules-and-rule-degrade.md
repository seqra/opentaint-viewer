# Custom Rules and Missing-Rule Degrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the viewer load a project's own rules via a new `--rules` flag (the engine's shipped ruleset becomes `--builtin-rules`), and make the "no rule definition available" state explicit in the finding panel.

**Architecture:** The CLI reads two rule directories — builtin (`--builtin-rules`, origin `builtin`) and custom (`--rules`, origin `custom`) — merges them into `content.rules`, and builds the rule-id index custom-first so a custom rule wins on collision. The viewer's existing "Custom" tree group and finding→rule link work unchanged for custom rules; when a finding's `ruleId` resolves to no rule file, `FindingInfo` renders a muted marker instead of a bare id.

**Tech Stack:** TypeScript, Node (CLI), React + Zustand (viewer), Vitest + Testing Library.

---

## Background facts (read before starting)

- `src/cli/generateContent.ts` builds `ViewerContent`. `readRules(dir)` walks a dir, collects `.yaml`/`.yml`, tags each `origin: 'builtin'`. `buildRuleIndex(rules)` maps each rule's inner `id:` → file path and is **first-write-wins** (`if (!index.has(id)) index.set(...)`). `ruleFileFor(ruleId, index)` strips a leading `java.<lang>.` prefix, then falls back to the full id; returns `null` on miss. `GenerateOptions` is an options object with `rulesDir`.
- `src/cli/resolve.ts` has `resolveRulesDir(cliUrl, rulesArg)` → `rulesArg ?? <cliDir>/../lib/rules`. Its only caller is `src/cli/main.ts`.
- `src/cli/main.ts` parses args (generic `--key value` parser in `args.ts`, so `--builtin-rules` → key `'builtin-rules'`), resolves the rules dir, calls `generateContent`, then injects + serves/exports.
- `src/components/FindingInfo.tsx` renders the finding; when `finding.ruleFile` is set it shows a clickable `ruleLink` button, else a bare `<span>{finding.ruleId}</span>`.
- `src/components/RulesTree.tsx` already renders **Builtin** and **Custom** origin groups keyed/selected by `rule.id` (= `path`). No change needed once custom rules populate `content.rules`.
- `src/types/content.ts` already defines `RuleOrigin = 'builtin' | 'custom'` and `RuleSpec.origin`. **No type changes needed.**
- `scripts/gen-content.ts` (legacy `npm run gen`) calls `generateContent({ ..., rulesDir: resolve(rulesArg), ... })`. Because this plan keeps the `rulesDir` option name, gen-content stays untouched.

## File structure

```
src/cli/generateContent.ts        Task 1 — readRules(dir, origin); load builtin+custom; dedup; custom-first index
src/cli/generateContent.test.ts   Task 1 — custom-rule unit tests
src/cli/resolve.ts                 Task 2 — resolveRulesDir -> resolveBuiltinRulesDir (rename, same logic)
src/cli/resolve.test.ts            Task 2 — updated for the rename
src/cli/main.ts                    Task 2 — parse --builtin-rules + --rules; USAGE; pass both
src/cli/main.test.ts               Task 2 — flags updated; custom + missing-dir cases
src/components/FindingInfo.tsx     Task 3 — degrade marker
src/components/FindingInfo.module.css  Task 3 — .ruleMissing
src/components/FindingInfo.test.tsx    Task 3 — degrade test
README.md                          Task 4 — flag table + examples
```

---

### Task 1: generateContent loads builtin + custom rules (custom wins)

**Files:**
- Modify: `src/cli/generateContent.ts`
- Test: `src/cli/generateContent.test.ts`

- [ ] **Step 1: Add custom-rule fixtures to the test setup**

In `src/cli/generateContent.test.ts`, extend the existing `beforeAll` (which already creates `proj/src` and `rules/`) by appending these lines inside it, after the existing `writeFileSync(join(dir, 'rules', 'other.yaml'), ...)` line:

```typescript
  // custom rules: a brand-new rule, plus one whose id collides with builtin xss
  mkdirSync(join(dir, 'custom'), { recursive: true });
  writeFileSync(join(dir, 'custom', 'mine.yaml'), 'id: my-custom-rule\n');
  writeFileSync(join(dir, 'custom', 'override-xss.yaml'), 'id: xss-in-spring-app\n');
  // a custom rule sharing the SAME relative path as a builtin one
  mkdirSync(join(dir, 'custom-samepath'), { recursive: true });
  writeFileSync(join(dir, 'custom-samepath', 'xss.yaml'), 'id: xss-in-spring-app\n');
```

- [ ] **Step 2: Write the failing custom-rule tests**

Add this `describe` block at the end of `src/cli/generateContent.test.ts` (after the existing `describe('generateContent', ...)`):

```typescript
const sarifCustomId = {
  runs: [{
    tool: { driver: { name: 'OpenTaint', rules: [] } },
    results: [{
      ruleId: 'my-custom-rule', level: 'error', message: { text: 'm' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 1 } } }],
      codeFlows: [{ threadFlows: [{ locations: [
        { location: { physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 1 } }, message: { text: 'source' } }, kinds: ['taint'] },
      ] }] }],
    }],
  }],
};

describe('generateContent — custom rules', () => {
  it('loads custom rules tagged origin "custom" and resolves a finding to one', () => {
    const c = generateContent({
      sarifLog: sarifCustomId,
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),
      customRulesDir: join(dir, 'custom'),
      projectId: 'demo',
    });
    const custom = c.rules.filter((r) => r.origin === 'custom').map((r) => r.path).sort();
    expect(custom).toEqual(['mine.yaml', 'override-xss.yaml']);
    expect(c.rules.find((r) => r.path === 'mine.yaml')?.origin).toBe('custom');
    expect(c.findings[0].ruleFile).toBe('mine.yaml');
  });

  it('lets a custom rule win on an id collision with builtin', () => {
    const c = generateContent({
      sarifLog: sarif, // top-level fixture: ruleId java.security.xss-in-spring-app
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),       // builtin xss.yaml has id: xss-in-spring-app
      customRulesDir: join(dir, 'custom'), // override-xss.yaml has the same id
      projectId: 'demo',
    });
    expect(c.findings[0].ruleFile).toBe('override-xss.yaml');
    // both files are present because their relative paths differ
    expect(c.rules.some((r) => r.path === 'xss.yaml' && r.origin === 'builtin')).toBe(true);
    expect(c.rules.some((r) => r.path === 'override-xss.yaml' && r.origin === 'custom')).toBe(true);
  });

  it('replaces a builtin rule when a custom rule shares its relative path', () => {
    const c = generateContent({
      sarifLog: sarif,
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),
      customRulesDir: join(dir, 'custom-samepath'), // also contains xss.yaml
      projectId: 'demo',
    });
    const xss = c.rules.filter((r) => r.path === 'xss.yaml');
    expect(xss).toHaveLength(1);
    expect(xss[0].origin).toBe('custom');
    expect(c.findings[0].ruleFile).toBe('xss.yaml');
  });

  it('omits custom rules entirely when customRulesDir is not given', () => {
    const c = generateContent({
      sarifLog: sarif,
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),
      projectId: 'demo',
    });
    expect(c.rules.every((r) => r.origin === 'builtin')).toBe(true);
    expect(c.findings[0].ruleFile).toBe('xss.yaml');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/cli/generateContent.test.ts`
Expected: FAIL — `customRulesDir` is not a valid `GenerateOptions` property (TS error) and/or the new assertions fail.

- [ ] **Step 4: Generalize `readRules` and load both rule sets**

In `src/cli/generateContent.ts`:

(a) Add `RuleOrigin` to the type import:

```typescript
import type { Finding, Language, ProjectFile, RuleOrigin, RuleSpec, ViewerContent } from '../types/content';
```

(b) Replace the `readRules` function:

```typescript
function readRules(rulesDir: string, origin: RuleOrigin): RuleSpec[] {
  return walk(rulesDir)
    .filter((p) => extname(p) === '.yaml' || extname(p) === '.yml')
    .map((p) => relative(rulesDir, p))
    .sort()
    .map((path) => ({ id: path, origin, path, content: readFileSync(join(rulesDir, path), 'utf8') }));
}
```

(c) Add `customRulesDir` to `GenerateOptions` (keep `rulesDir` as the builtin dir):

```typescript
export interface GenerateOptions {
  sarifLog: unknown;
  /** Directory walked for source files. */
  srcDir: string;
  /** Base that collected file paths (and SARIF URIs) are relative to. */
  root: string;
  /** Builtin ruleset directory; every .yaml/.yml under it is included (origin 'builtin'). */
  rulesDir: string;
  /** Optional custom ruleset directory (origin 'custom'); custom wins on id/path collision. */
  customRulesDir?: string;
  /** Project name surfaced in the viewer UI. */
  projectId: string;
}
```

(d) Replace the rule-loading lines inside `generateContent` — i.e. swap

```typescript
  const rules = readRules(opts.rulesDir);
  const index = buildRuleIndex(rules);
```

for:

```typescript
  const builtin = readRules(opts.rulesDir, 'builtin');
  const custom = opts.customRulesDir ? readRules(opts.customRulesDir, 'custom') : [];
  // On an identical relative path, the custom rule replaces the builtin one (keeps RuleSpec.id unique).
  const customPaths = new Set(custom.map((r) => r.path));
  const builtinKept = builtin.filter((r) => !customPaths.has(r.path));
  // Display order: builtin group first, then custom.
  const rules = [...builtinKept, ...custom];
  // Resolution order: custom first, so a custom `id:` wins on collision (index is first-write-wins).
  const index = buildRuleIndex([...custom, ...builtinKept]);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/cli/generateContent.test.ts`
Expected: PASS (the new custom block and the original `generateContent` tests).

- [ ] **Step 6: Commit**

```bash
git add src/cli/generateContent.ts src/cli/generateContent.test.ts
git commit -m "feat: load custom rules in generateContent (custom wins on collision)"
```

---

### Task 2: CLI flags — rename `--rules` to `--builtin-rules`, add custom `--rules`

**Files:**
- Modify: `src/cli/resolve.ts`
- Modify: `src/cli/main.ts`
- Test: `src/cli/resolve.test.ts`, `src/cli/main.test.ts`

- [ ] **Step 1: Update the resolver test for the rename (failing)**

In `src/cli/resolve.test.ts`, change the import line:

```typescript
import { srcRootFromSarif, resolveSourceRoot, resolveBuiltinRulesDir } from './resolve';
```

and replace the entire `describe('resolveRulesDir', ...)` block with:

```typescript
describe('resolveBuiltinRulesDir', () => {
  const cliUrl = pathToFileURL('/opt/opentaint/bin/opentaint-viewer.js').href;
  it('honours an explicit --builtin-rules', () => {
    expect(resolveBuiltinRulesDir(cliUrl, dir)).toBe(resolve(dir));
  });
  it('defaults to ../lib/rules relative to the CLI executable', () => {
    expect(resolveBuiltinRulesDir(cliUrl)).toBe('/opt/opentaint/lib/rules');
  });
});
```

- [ ] **Step 2: Run the resolver test to verify it fails**

Run: `npx vitest run src/cli/resolve.test.ts`
Expected: FAIL — `resolveBuiltinRulesDir` is not exported by `./resolve`.

- [ ] **Step 3: Rename the resolver**

In `src/cli/resolve.ts`, replace the `resolveRulesDir` function with:

```typescript
/** Builtin ruleset dir: --builtin-rules wins; else ../lib/rules relative to the CLI executable. */
export function resolveBuiltinRulesDir(cliUrl: string, builtinRulesArg?: string): string {
  if (builtinRulesArg) return resolve(builtinRulesArg);
  const binDir = dirname(fileURLToPath(cliUrl));
  return resolve(binDir, '..', 'lib', 'rules');
}
```

- [ ] **Step 4: Run the resolver test to verify it passes**

Run: `npx vitest run src/cli/resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Update main.test.ts (failing)**

In `src/cli/main.test.ts`:

(a) In both existing tests, change the rules flag from `--rules` to `--builtin-rules`. The two arg arrays become:

```typescript
    execFileSync('npx', ['tsx', 'src/cli/main.ts', 'export',
      '--sarif', join(dir, 'report.sarif'),
      '--builtin-rules', join(dir, 'rules'),
      '--out', out,
    ], { stdio: 'pipe', env: { ...process.env, OPENTAINT_VIEWER_TEMPLATE: join(dir, 'template.html') } });
```

and

```typescript
    expect(() => execFileSync('npx', ['tsx', 'src/cli/main.ts', 'export',
      '--sarif', join(dir, 'nope.sarif'), '--builtin-rules', join(dir, 'rules'),
    ], { stdio: 'pipe', env: { ...process.env, OPENTAINT_VIEWER_TEMPLATE: join(dir, 'template.html') } })).toThrow();
```

(b) Add these two tests inside `describe('opentaint-viewer export', ...)`:

```typescript
  it('includes custom rules (origin "custom") in the output when --rules is given', () => {
    const out = join(dir, 'report-custom.html');
    mkdirSync(join(dir, 'custom'), { recursive: true });
    writeFileSync(join(dir, 'custom', 'mine.yaml'), 'id: mine\n');
    execFileSync('npx', ['tsx', 'src/cli/main.ts', 'export',
      '--sarif', join(dir, 'report.sarif'),
      '--builtin-rules', join(dir, 'rules'),
      '--rules', join(dir, 'custom'),
      '--out', out,
    ], { stdio: 'pipe', env: { ...process.env, OPENTAINT_VIEWER_TEMPLATE: join(dir, 'template.html') } });
    const html = readFileSync(out, 'utf8');
    const json = html.replace(/^[\s\S]*id="opentaint-content">/, '').replace(/<\/script>[\s\S]*$/, '');
    const content = JSON.parse(json);
    expect(content.rules.some((r: { origin: string; path: string }) => r.origin === 'custom' && r.path === 'mine.yaml')).toBe(true);
  });

  it('exits non-zero when --rules dir does not exist', () => {
    expect(() => execFileSync('npx', ['tsx', 'src/cli/main.ts', 'export',
      '--sarif', join(dir, 'report.sarif'),
      '--builtin-rules', join(dir, 'rules'),
      '--rules', join(dir, 'nope-custom'),
    ], { stdio: 'pipe', env: { ...process.env, OPENTAINT_VIEWER_TEMPLATE: join(dir, 'template.html') } })).toThrow();
  });
```

- [ ] **Step 6: Run main.test.ts to verify it fails**

Run: `npx vitest run src/cli/main.test.ts`
Expected: FAIL — `main.ts` still imports `resolveRulesDir` (TS error) and does not parse `--builtin-rules`/`--rules`.

- [ ] **Step 7: Wire the flags in main.ts**

In `src/cli/main.ts`:

(a) Update the resolve import:

```typescript
import { resolveSourceRoot, resolveBuiltinRulesDir } from './resolve';
```

(b) Replace the `USAGE` constant:

```typescript
const USAGE = `opentaint-viewer <serve|export> --sarif <file> [options]

  --sarif <file>          SARIF report (required)
  --src <dir>             source root (default: SARIF %SRCROOT%, else the SARIF's directory)
  --builtin-rules <dir>   builtin ruleset dir (default: ../lib/rules relative to the CLI)
  --rules <dir>           custom ruleset dir (optional; your project's own rules)
  --name <id>             project name shown in the UI (default: basename of source root)

serve:   --port <n> (default 5151)   --no-open
export:  --out <file> (default opentaint-report.html)`;
```

(c) Replace the rule-dir block inside `buildContent` — i.e. swap

```typescript
  const rulesDir = resolveRulesDir(cliUrl, str(args.rules));
  if (!existsSync(rulesDir)) fail(`rules dir not found: ${rulesDir} (pass --rules <dir>)`);

  const projectId = str(args.name) ?? basename(srcRoot);
  const content = generateContent({ sarifLog, srcDir: srcRoot, root: srcRoot, rulesDir, projectId });
```

for:

```typescript
  const rulesDir = resolveBuiltinRulesDir(cliUrl, str(args['builtin-rules']));
  if (!existsSync(rulesDir)) fail(`builtin rules dir not found: ${rulesDir} (pass --builtin-rules <dir>)`);
  const customArg = str(args.rules);
  const customRulesDir = customArg !== undefined ? resolve(customArg) : undefined;
  if (customRulesDir !== undefined && !existsSync(customRulesDir)) {
    fail(`custom rules dir not found: ${customRulesDir} (pass --rules <dir>)`);
  }

  const projectId = str(args.name) ?? basename(srcRoot);
  const content = generateContent({ sarifLog, srcDir: srcRoot, root: srcRoot, rulesDir, customRulesDir, projectId });
```

(`resolve` and `existsSync` are already imported in `main.ts`.)

- [ ] **Step 8: Run main + resolve tests to verify they pass**

Run: `npx vitest run src/cli/main.test.ts src/cli/resolve.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/cli/resolve.ts src/cli/resolve.test.ts src/cli/main.ts src/cli/main.test.ts
git commit -m "feat: --builtin-rules (renamed) and --rules (custom) CLI flags"
```

---

### Task 3: FindingInfo degrade marker for a missing rule

**Files:**
- Modify: `src/components/FindingInfo.tsx`
- Modify: `src/components/FindingInfo.module.css`
- Test: `src/components/FindingInfo.test.tsx`

- [ ] **Step 1: Write the failing degrade test**

Add this test inside `describe('FindingInfo', ...)` in `src/components/FindingInfo.test.tsx`:

```typescript
  it('shows a "definition not available" marker (no link) when the rule file is missing', () => {
    const noRule = {
      ...content,
      findings: content.findings.map((f, i) => (i === 0 ? { ...f, ruleFile: null } : f)),
    };
    useStore.getState().reset();
    useStore.getState().loadContent(noRule);
    render(<FindingInfo />);
    const f0 = noRule.findings[0];
    expect(screen.queryByRole('button', { name: f0.ruleId })).toBeNull();
    expect(screen.getByText(/definition not available/)).toBeInTheDocument();
    expect(screen.getByTestId('finding-info').textContent).toContain(f0.ruleId);
    expect(screen.getByText(f0.message)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/FindingInfo.test.tsx`
Expected: FAIL — no element matches `/definition not available/`.

- [ ] **Step 3: Render the marker on the degrade branch**

In `src/components/FindingInfo.tsx`, replace the `else` branch of the rule block — i.e. swap

```tsx
        ) : (
          <span>{finding.ruleId}</span>
        )}
```

for:

```tsx
        ) : (
          <span>
            {finding.ruleId}
            <span className={styles.ruleMissing} title="No rule definition was bundled for this rule id"> · definition not available</span>
          </span>
        )}
```

- [ ] **Step 4: Add the muted style**

Append to `src/components/FindingInfo.module.css`:

```css
.ruleMissing { font-style: italic; opacity: 0.7; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/FindingInfo.test.tsx`
Expected: PASS (the new degrade test plus the existing happy-path link test).

- [ ] **Step 6: Commit**

```bash
git add src/components/FindingInfo.tsx src/components/FindingInfo.module.css src/components/FindingInfo.test.tsx
git commit -m "feat: mark findings whose rule definition is unavailable"
```

---

### Task 4: Document the flags in the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the CLI intro and options table**

In `README.md`, in the "Use the `opentaint-viewer` CLI" section, change the intro phrase
`and the ruleset defaults to` to `and the builtin ruleset defaults to`.

Then in the options table, replace this row:

```markdown
| `--rules <dir>` | `../lib/rules` relative to the CLI | Ruleset directory. |
```

with these two rows:

```markdown
| `--builtin-rules <dir>` | `../lib/rules` relative to the CLI | Builtin ruleset directory (the engine's shipped rules). |
| `--rules <dir>` | — (optional) | Your project's custom rules; shown under "Custom" and linked from findings. Custom wins on an id collision with a builtin rule. A rule in neither set still renders, marked "definition not available". |
```

- [ ] **Step 2: Add a custom-rules example**

In the same section, immediately after the fenced example block that contains
`opentaint-viewer export --sarif results.sarif --out report.html`, insert:

```markdown
Bring your own rules alongside the builtin set:

\`\`\`bash
opentaint-viewer serve --sarif results.sarif --rules ./my-rules
\`\`\`
```

(Write the example block with real backticks — the `\`` above is only escaping for this plan.)

- [ ] **Step 3: Verify the doc reads correctly**

Run: `grep -n "builtin-rules\|custom rules\|definition not available" README.md`
Expected: shows the two new table rows and the example.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document --builtin-rules and the custom --rules flag"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass (CLI unit tests, `FindingInfo`, and the rest of the suite).

- [ ] **Step 3: Smoke-test serve with a custom rule (manual, optional)**

```bash
mkdir -p /tmp/ot-custom && printf 'rules:\n  - id: ssrf\n    message: my override\n' > /tmp/ot-custom/ssrf.yaml
npm run cli -- serve \
  --sarif /Users/misonijnik/.opentaint/cache/hertzbeat-24ece53a/project-model/sources/opentaint.sarif \
  --src   /Users/misonijnik/Workspace/github/hertzbeat \
  --builtin-rules /Users/misonijnik/.opentaint/install/lib/rules \
  --rules /tmp/ot-custom
```
Expected: the server starts; the Rules tab shows a **Custom** group containing `ssrf.yaml`, and the SSRF findings link to the custom file.

- [ ] **Step 4: Final commit (only if Steps 1–2 required a fix)**

```bash
git add -A
git commit -m "test: verify custom-rules and degrade behavior"
```

---

## Self-review notes

- **Spec coverage:** `--builtin-rules`/`--rules` flags (Task 2) ✓; load both + custom-first index + path dedup (Task 1) ✓; custom wins on id collision (Task 1, Step 2 test) ✓; degrade marker (Task 3) ✓; README rename + custom flag (Task 4) ✓; `override` field intentionally **not** implemented (deferred per spec — no task) ✓; no `src/types/content.ts` change (origin/RuleOrigin already exist) ✓.
- **Type consistency:** option object uses `rulesDir` (builtin) + `customRulesDir?` consistently across `generateContent.ts`, `main.ts`, and all tests; resolver renamed to `resolveBuiltinRulesDir` everywhere it appears (`resolve.ts`, `resolve.test.ts`, `main.ts`). `scripts/gen-content.ts` keeps `rulesDir` and needs no change.
- **No placeholders:** every code step shows the exact code; every run step states the expected result.
```
