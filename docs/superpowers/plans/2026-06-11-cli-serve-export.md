# OpenTaint Viewer CLI (`serve` / `export`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `opentaint-viewer` CLI with two commands — `serve` (render a SARIF report on localhost) and `export` (write a self-contained HTML report) — that default the source root from the SARIF and the rules dir from `../lib/rules` relative to the CLI.

**Architecture:** A prebuilt single-file HTML *template* (Monaco/JS/CSS inlined, demo content stubbed out) carries a JSON placeholder. At runtime the CLI parses the SARIF, collects sources + rules into a `ViewerContent` object, and string-injects it into the template — no Vite/tsc at runtime. `loadContent()` precedence becomes injected JSON → bundled demo → throw, so `npm run dev`, the committed demo, and all existing tests keep working via the fallback.

**Tech Stack:** TypeScript, Node built-ins (`node:fs`, `node:http`, `node:path`, `node:url`, `node:child_process`), Vite + `vite-plugin-singlefile` (template build), esbuild (CLI bundle), Vitest (tests). Reuses `src/pipeline/sarif.ts`.

Spec: `docs/superpowers/specs/2026-06-11-cli-serve-export-design.md`.

---

## File Structure

**New files:**
- `src/content/bundledContent.ts` — static import of the demo `data/content.json`.
- `src/content/bundledContent.stub.ts` — null stub aliased in the `template` build.
- `src/cli/render.ts` — `injectContent(template, content)` pure string injection + escaping.
- `src/cli/render.test.ts`
- `src/cli/resolve.ts` — `srcRootFromSarif`, `resolveSourceRoot`, `resolveRulesDir`.
- `src/cli/resolve.test.ts`
- `src/cli/generateContent.ts` — pure SARIF+files+rules → `ViewerContent` (extracted from `scripts/gen-content.ts`).
- `src/cli/generateContent.test.ts`
- `src/cli/serve.ts` — `startServer`, `openBrowser`, `serve`.
- `src/cli/serve.test.ts`
- `src/cli/template.ts` — `loadTemplate(cliUrl)` resolves the template file.
- `src/cli/template.test.ts`
- `src/cli/args.ts` — `parseArgs`.
- `src/cli/args.test.ts`
- `src/cli/main.ts` — bin entry: dispatch `serve` / `export`.
- `src/cli/main.test.ts` — integration: run `export` end-to-end.
- `scripts/copy-template.mjs` — copy the built template next to the CLI bundle + set exec bit.

**Modified files:**
- `src/content/loadContent.ts` — injected JSON → `bundledContent` → throw.
- `scripts/gen-content.ts` — delegate collection to `src/cli/generateContent.ts`.
- `vite.config.ts` — add `template` mode (singlefile + placeholder plugin + stub alias).
- `package.json` — `bin`, `build:template`, `build:cli`, `build:dist`, `cli` scripts; `esbuild` devDep.
- `README.md` — document `serve` / `export`.

---

## Task 1: Split content loading for runtime injection

**Files:**
- Create: `src/content/bundledContent.ts`, `src/content/bundledContent.stub.ts`
- Modify: `src/content/loadContent.ts`
- Test: `src/content/loadContent.test.ts` (existing — must stay green; add one case)

- [ ] **Step 1: Create the bundled-content module and its stub**

`src/content/bundledContent.ts`:

```ts
import raw from '../../data/content.json';

/** The committed demo content, baked into the dev/hosted/single-file bundles. */
export const bundledContent: unknown = raw;
```

`src/content/bundledContent.stub.ts`:

```ts
/** Replaces bundledContent.ts in the `template` build so the ~0.5 MB demo
 * content is NOT shipped inside the CLI template. The CLI injects real content. */
export const bundledContent: unknown = null;
```

- [ ] **Step 2: Write a failing test for injected-content precedence**

Append to `src/content/loadContent.test.ts`:

```ts
describe('loadContent injection', () => {
  it('prefers injected #opentaint-content JSON over the bundled demo', () => {
    const injected = {
      projectId: 'injected-proj', files: [], rules: [],
      findings: [{ flows: [{ steps: [] }], defaultFlowIndex: 0 }],
    };
    const el = document.createElement('script');
    el.type = 'application/json';
    el.id = 'opentaint-content';
    el.textContent = JSON.stringify(injected);
    document.body.appendChild(el);
    try {
      expect(loadContent().projectId).toBe('injected-proj');
    } finally {
      el.remove();
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/content/loadContent.test.ts`
Expected: FAIL — current `loadContent` ignores the DOM and returns the demo (`java-spring-demo`).

- [ ] **Step 4: Rewrite `loadContent.ts` to read injected content with fallback**

Replace **all three existing import lines** at the top of `src/content/loadContent.ts`
(`import raw from '../../data/content.json';`, the `import { isViewerContent }` line,
and the `import type { … }` line) **and** the existing `loadContent` function with the
block below. Do not leave the old imports — they would duplicate. Leave the rest of the
file (`findingById`, `fileByPath`, `flowSteps`, `rulesByOrigin`) unchanged.

```ts
import { bundledContent } from './bundledContent';
import { isViewerContent } from '../types/content';
import type { Finding, ViewerContent, ProjectFile, RuleOrigin, RuleSpec, TaintStep } from '../types/content';

/** Content injected by the CLI into the prebuilt template, if present. */
function injectedContent(): unknown {
  if (typeof document === 'undefined') return undefined;
  const el = document.getElementById('opentaint-content');
  if (!el?.textContent) return undefined;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return undefined;
  }
}

export function loadContent(): ViewerContent {
  const raw = injectedContent() ?? bundledContent;
  if (!isViewerContent(raw)) throw new Error('Bundled content is invalid');
  return raw;
}
```

Leave the rest of the file (`findingById`, `fileByPath`, `flowSteps`, `rulesByOrigin`) unchanged.

- [ ] **Step 5: Run the loadContent + contract tests**

Run: `npx vitest run src/content/loadContent.test.ts src/content/content-contract.test.ts`
Expected: PASS (new injection test passes; existing demo cases still pass via the fallback).

- [ ] **Step 6: Commit**

```bash
git add src/content/bundledContent.ts src/content/bundledContent.stub.ts src/content/loadContent.ts src/content/loadContent.test.ts
git commit -m "feat: load injected content from the template, fall back to bundled demo"
```

---

## Task 2: Content injection (`render.ts`)

**Files:**
- Create: `src/cli/render.ts`
- Test: `src/cli/render.test.ts`

- [ ] **Step 1: Write the failing test**

`src/cli/render.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { injectContent, CONTENT_PLACEHOLDER } from './render';
import type { ViewerContent } from '../types/content';

const TEMPLATE = `<html><head></head><body><script type="application/json" id="opentaint-content">${CONTENT_PLACEHOLDER}</script></body></html>`;

function extractJson(html: string): string {
  return html.replace(/^[\s\S]*id="opentaint-content">/, '').replace(/<\/script>[\s\S]*$/, '');
}

describe('injectContent', () => {
  const content: ViewerContent = {
    projectId: 'p', files: [], rules: [],
    findings: [{
      id: 'f', ruleId: 'r', vulnClass: 'XSS', severity: 'error', endpoint: null,
      location: null, file: null, ruleFile: null, message: 'm',
      flows: [{ steps: [] }], defaultFlowIndex: 0,
    }],
  };

  it('round-trips the content through the placeholder', () => {
    const html = injectContent(TEMPLATE, content);
    expect(JSON.parse(extractJson(html))).toEqual(content);
  });

  it('escapes embedded </script> so it cannot break out of the tag', () => {
    const dangerous: ViewerContent = {
      ...content,
      files: [{ path: 'A.java', language: 'java', content: 'x </script><script>alert(1)</script> y' }],
    };
    const html = injectContent(TEMPLATE, dangerous);
    // exactly one real closing tag — the injected JSON must not contain another
    expect(html.split('</script>')).toHaveLength(2);
    expect(JSON.parse(extractJson(html))).toEqual(dangerous);
  });

  it('throws when the template lacks the placeholder', () => {
    expect(() => injectContent('<html></html>', content)).toThrow(/placeholder/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/cli/render.test.ts`
Expected: FAIL — `./render` does not exist.

- [ ] **Step 3: Implement `render.ts`**

`src/cli/render.ts`:

```ts
import type { ViewerContent } from '../types/content';

/** Token the `template` build writes into the content <script>; the CLI replaces it. */
export const CONTENT_PLACEHOLDER = '__OPENTAINT_CONTENT__';

/** JSON-encode `content` so it is safe as the text of an inline <script>:
 * every `<` becomes `<` (neutralizing `</script>` and `<!--`), and the
 * U+2028/U+2029 line separators are escaped. JSON.parse restores the originals. */
function encodeForScript(content: ViewerContent): string {
  return JSON.stringify(content)
    .replace(/</g, '\\u003c')
    .replace(/ /g, '\\u2028')
    .replace(/ /g, '\\u2029');
}

export function injectContent(template: string, content: ViewerContent): string {
  if (!template.includes(CONTENT_PLACEHOLDER)) {
    throw new Error('template is missing the content placeholder');
  }
  return template.replace(CONTENT_PLACEHOLDER, encodeForScript(content));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/cli/render.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add src/cli/render.ts src/cli/render.test.ts
git commit -m "feat: inject viewer content into the HTML template (script-safe)"
```

---

## Task 3: Source-root & rules resolvers (`resolve.ts`)

**Files:**
- Create: `src/cli/resolve.ts`
- Test: `src/cli/resolve.test.ts`

- [ ] **Step 1: Write the failing test**

`src/cli/resolve.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { srcRootFromSarif, resolveSourceRoot, resolveRulesDir } from './resolve';

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'resolve-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const sarifWith = (uri?: string) => ({
  runs: [{ originalUriBaseIds: uri ? { '%SRCROOT%': { uri } } : undefined }],
});

describe('srcRootFromSarif', () => {
  it('reads %SRCROOT% and trims a trailing slash', () => {
    expect(srcRootFromSarif(sarifWith('/project/'))).toBe('/project');
  });
  it('accepts a file: URL', () => {
    expect(srcRootFromSarif(sarifWith('file:///tmp/proj/'))).toBe('/tmp/proj');
  });
  it('returns null when absent', () => {
    expect(srcRootFromSarif(sarifWith(undefined))).toBeNull();
  });
});

describe('resolveSourceRoot', () => {
  it('honours an explicit --src over everything', () => {
    expect(resolveSourceRoot(sarifWith('/project/'), '/x/report.sarif', dir)).toBe(resolve(dir));
  });
  it('uses %SRCROOT% when it exists on disk', () => {
    expect(resolveSourceRoot(sarifWith(dir), join(dir, 'report.sarif'))).toBe(dir);
  });
  it('falls back to the SARIF directory when %SRCROOT% is missing or absent on disk', () => {
    expect(resolveSourceRoot(sarifWith('/no/such/root'), join(dir, 'report.sarif'))).toBe(resolve(dir));
    expect(resolveSourceRoot(sarifWith(undefined), join(dir, 'report.sarif'))).toBe(resolve(dir));
  });
});

describe('resolveRulesDir', () => {
  const cliUrl = pathToFileURL('/opt/opentaint/bin/opentaint-viewer.js').href;
  it('honours an explicit --rules', () => {
    expect(resolveRulesDir(cliUrl, dir)).toBe(resolve(dir));
  });
  it('defaults to ../lib/rules relative to the CLI executable', () => {
    expect(resolveRulesDir(cliUrl)).toBe('/opt/opentaint/lib/rules');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/cli/resolve.test.ts`
Expected: FAIL — `./resolve` does not exist.

- [ ] **Step 3: Implement `resolve.ts`**

`src/cli/resolve.ts`:

```ts
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface SarifSrcRoot {
  runs?: Array<{ originalUriBaseIds?: Record<string, { uri?: string }> }>;
}

/** The SARIF's %SRCROOT% as a local filesystem path (trailing slash trimmed), or null. */
export function srcRootFromSarif(log: SarifSrcRoot): string | null {
  const uri = log.runs?.[0]?.originalUriBaseIds?.['%SRCROOT%']?.uri;
  if (!uri) return null;
  const path = uri.startsWith('file:') ? fileURLToPath(uri) : uri;
  return path.replace(/\/+$/, '') || '/';
}

/** Source root: --src wins; else %SRCROOT% if it exists on disk; else the SARIF's directory. */
export function resolveSourceRoot(log: SarifSrcRoot, sarifPath: string, srcArg?: string): string {
  if (srcArg) return resolve(srcArg);
  const fromSarif = srcRootFromSarif(log);
  if (fromSarif && existsSync(fromSarif)) return fromSarif;
  return resolve(dirname(sarifPath));
}

/** Rules dir: --rules wins; else ../lib/rules relative to the CLI executable. */
export function resolveRulesDir(cliUrl: string, rulesArg?: string): string {
  if (rulesArg) return resolve(rulesArg);
  const binDir = dirname(fileURLToPath(cliUrl));
  return resolve(binDir, '..', 'lib', 'rules');
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/cli/resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/resolve.ts src/cli/resolve.test.ts
git commit -m "feat: resolve source root from SARIF %SRCROOT% and rules from ../lib/rules"
```

---

## Task 4: Extract `generateContent`

**Files:**
- Create: `src/cli/generateContent.ts`
- Modify: `scripts/gen-content.ts`
- Test: `src/cli/generateContent.test.ts` (new) and `scripts/gen-content.test.ts` (existing — must stay green)

- [ ] **Step 1: Write the failing test for the extracted function**

`src/cli/generateContent.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateContent } from './generateContent';

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
  dir = mkdtempSync(join(tmpdir(), 'gencontent-'));
  mkdirSync(join(dir, 'proj', 'src'), { recursive: true });
  mkdirSync(join(dir, 'rules'), { recursive: true });
  writeFileSync(join(dir, 'proj', 'src', 'A.java'), 'class A {}');
  writeFileSync(join(dir, 'proj', 'src', 'B.java'), 'class B {}');
  writeFileSync(join(dir, 'rules', 'xss.yaml'), 'id: xss-in-spring-app\n');
  writeFileSync(join(dir, 'rules', 'other.yaml'), 'id: other\n');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('generateContent', () => {
  it('prunes files to those referenced, keeps all rules, links rule files', () => {
    const c = generateContent({
      sarifLog: sarif,
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),
      projectId: 'demo',
    });
    expect(c.projectId).toBe('demo');
    expect(c.tool).toEqual({ name: 'OpenTaint', semanticVersion: '9.9.9', version: 'analyzer/test' });
    expect(c.files.map((f) => f.path)).toEqual(['src/A.java']);
    expect(c.rules.map((r) => r.path).sort()).toEqual(['other.yaml', 'xss.yaml']);
    expect(c.findings[0].ruleFile).toBe('xss.yaml');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/cli/generateContent.test.ts`
Expected: FAIL — `./generateContent` does not exist.

- [ ] **Step 3: Implement `generateContent.ts`** (port the helpers verbatim from `scripts/gen-content.ts`)

`src/cli/generateContent.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { transformSarif, toolInfo } from '../pipeline/sarif';
import { isViewerContent } from '../types/content';
import type { Finding, Language, ProjectFile, RuleSpec, ViewerContent } from '../types/content';

const LANG_BY_EXT: Record<string, Language> = {
  '.java': 'java', '.kt': 'kotlin', '.yml': 'yaml', '.yaml': 'yaml', '.xml': 'xml', '.properties': 'properties',
};

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

export interface GenerateOptions {
  sarifLog: unknown;
  /** Directory walked for source files. */
  srcDir: string;
  /** Base that collected file paths (and SARIF URIs) are relative to. */
  root: string;
  rulesDir: string;
  projectId: string;
}

export function generateContent(opts: GenerateOptions): ViewerContent {
  const sarif = opts.sarifLog as Parameters<typeof transformSarif>[0];
  const rules = readRules(opts.rulesDir);
  const index = buildRuleIndex(rules);
  const findings: Finding[] = transformSarif(sarif).map((f) => ({ ...f, ruleFile: ruleFileFor(f.ruleId, index) }));
  const referenced = new Set(findings.flatMap((f) => f.flows.flatMap((fl) => fl.steps.map((s) => s.file))));
  const files = collectFiles(opts.srcDir, opts.root, referenced);
  const tool = toolInfo(sarif);
  const content: ViewerContent = { projectId: opts.projectId, tool, files, rules, findings };
  if (!isViewerContent(content)) throw new Error('Generated content failed contract validation');
  return content;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/cli/generateContent.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `scripts/gen-content.ts` to delegate**

Replace the body of `scripts/gen-content.ts` with this (keeps the same CLI flags and behavior, drops the duplicated helpers):

```ts
/**
 * Generates the viewer content file (data/content.json) from an existing analysis.
 *
 * Usage:
 *   tsx scripts/gen-content.ts --sarif <file> --src <dir> --rules <dir> [--name <id>] [--root <dir>] [--out <file>]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { generateContent } from '../src/cli/generateContent';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  return args;
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

  const sarifLog = JSON.parse(readFileSync(sarifPath, 'utf8'));
  const content = generateContent({ sarifLog, srcDir, root, rulesDir: resolve(rulesArg), projectId });

  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, JSON.stringify(content, null, 2));
  console.log(`Wrote ${out}: ${content.findings.length} findings, ${content.files.length} files, ${content.rules.length} rules`);
}

try {
  main();
} catch (error) {
  console.error('gen-content failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
```

- [ ] **Step 6: Run the legacy gen-content test (must still pass)**

Run: `npx vitest run scripts/gen-content.test.ts src/cli/generateContent.test.ts`
Expected: PASS (the legacy spawn-based test is unchanged and still green).

- [ ] **Step 7: Commit**

```bash
git add src/cli/generateContent.ts src/cli/generateContent.test.ts scripts/gen-content.ts
git commit -m "refactor: extract generateContent; gen-content script delegates to it"
```

---

## Task 5: Argument parser (`args.ts`)

**Files:**
- Create: `src/cli/args.ts`
- Test: `src/cli/args.test.ts`

- [ ] **Step 1: Write the failing test**

`src/cli/args.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('parseArgs', () => {
  it('reads --key value pairs', () => {
    expect(parseArgs(['--sarif', 'r.sarif', '--name', 'demo'])).toEqual({ sarif: 'r.sarif', name: 'demo' });
  });
  it('treats --no-open as open=false', () => {
    expect(parseArgs(['--no-open'])).toEqual({ open: false });
  });
  it('treats a flag with no value (or followed by another flag) as true', () => {
    expect(parseArgs(['--src', '--rules', 'r'])).toEqual({ src: true, rules: 'r' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/cli/args.test.ts`
Expected: FAIL — `./args` does not exist.

- [ ] **Step 3: Implement `args.ts`**

`src/cli/args.ts`:

```ts
/** Minimal `--key value` / `--flag` / `--no-open` parser. No deps. */
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'no-open') { out.open = false; continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[key] = true; }
    else { out[key] = next; i++; }
  }
  return out;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/cli/args.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/args.ts src/cli/args.test.ts
git commit -m "feat: add minimal CLI argument parser"
```

---

## Task 6: HTTP server (`serve.ts`)

**Files:**
- Create: `src/cli/serve.ts`
- Test: `src/cli/serve.test.ts`

- [ ] **Step 1: Write the failing test**

`src/cli/serve.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { startServer } from './serve';

describe('startServer', () => {
  it('serves the given HTML and reports a usable URL', async () => {
    const html = '<html><body>hello-report</body></html>';
    const { url, close } = await startServer(html, 0); // port 0 = ephemeral
    try {
      const res = await fetch(url);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toBe(html);
    } finally {
      await close();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/cli/serve.test.ts`
Expected: FAIL — `./serve` does not exist.

- [ ] **Step 3: Implement `serve.ts`**

`src/cli/serve.ts`:

```ts
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';

export interface ServeOptions {
  port: number;
  open: boolean;
}

/** Start an HTTP server that returns `html` for every request. */
export function startServer(html: string, port: number): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolveP, rejectP) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.once('error', rejectP);
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address() as AddressInfo;
      resolveP({
        url: `http://127.0.0.1:${actual}/`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

/** Best-effort open of the OS default browser; failures are non-fatal. */
export function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] :
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] :
    ['xdg-open', [url]];
  try {
    spawn(cmd, args as string[], { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* opening a browser is a convenience, not a requirement */
  }
}

/** Serve `html`, retrying the next port if the preferred one is taken; keep alive until Ctrl+C. */
export async function serve(html: string, opts: ServeOptions): Promise<void> {
  for (let port = opts.port; port < opts.port + 10; port++) {
    try {
      const { url, close } = await startServer(html, port);
      console.log(`OpenTaint Viewer on ${url}  (Ctrl+C to stop)`);
      if (opts.open) openBrowser(url);
      process.on('SIGINT', () => { void close().then(() => process.exit(0)); });
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') continue;
      throw err;
    }
  }
  throw new Error(`no free port in range ${opts.port}-${opts.port + 9}`);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/cli/serve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/serve.ts src/cli/serve.test.ts
git commit -m "feat: add localhost HTTP server + browser opener for serve"
```

---

## Task 7: Template loader (`template.ts`)

**Files:**
- Create: `src/cli/template.ts`
- Test: `src/cli/template.test.ts`

- [ ] **Step 1: Write the failing test**

`src/cli/template.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { loadTemplate } from './template';

const cliUrl = pathToFileURL('/opt/opentaint/bin/opentaint-viewer.js').href;

afterEach(() => { delete process.env.OPENTAINT_VIEWER_TEMPLATE; });

describe('loadTemplate', () => {
  it('reads the file named by OPENTAINT_VIEWER_TEMPLATE', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tpl-'));
    try {
      const file = join(dir, 'index.html');
      writeFileSync(file, '<html>tpl</html>');
      process.env.OPENTAINT_VIEWER_TEMPLATE = file;
      expect(loadTemplate(cliUrl)).toBe('<html>tpl</html>');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws a build hint when no template can be found', () => {
    process.env.OPENTAINT_VIEWER_TEMPLATE = '/no/such/template.html';
    expect(() => loadTemplate(cliUrl)).toThrow(/build:template/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/cli/template.test.ts`
Expected: FAIL — `./template` does not exist.

- [ ] **Step 3: Implement `template.ts`**

`src/cli/template.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Candidate template locations, in priority order, given the CLI's own URL. */
function candidates(cliUrl: string): string[] {
  const list: string[] = [];
  if (process.env.OPENTAINT_VIEWER_TEMPLATE) list.push(process.env.OPENTAINT_VIEWER_TEMPLATE);
  // Bundled install / build: dist-cli/opentaint-viewer.js + dist-cli/template/index.html
  list.push(fileURLToPath(new URL('./template/index.html', cliUrl)));
  // Dev via tsx from src/cli/, or the bundle run from dist-cli/, pointing at the Vite output
  list.push(fileURLToPath(new URL('../../dist-template/index.html', cliUrl)));
  list.push(fileURLToPath(new URL('../dist-template/index.html', cliUrl)));
  return list;
}

export function loadTemplate(cliUrl: string): string {
  for (const path of candidates(cliUrl)) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error('viewer template not found; build it first with `npm run build:template`');
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/cli/template.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/template.ts src/cli/template.test.ts
git commit -m "feat: locate the prebuilt viewer template next to the CLI"
```

---

## Task 8: CLI entry (`main.ts`) + end-to-end `export` test

**Files:**
- Create: `src/cli/main.ts`, `src/cli/main.test.ts`

- [ ] **Step 1: Write the failing integration test** (drives `export` via `tsx`, using a fake template via env)

`src/cli/main.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { CONTENT_PLACEHOLDER } from './render';

const sarif = {
  runs: [{
    originalUriBaseIds: { '%SRCROOT%': { uri: '__SRCROOT__' } },
    tool: { driver: { name: 'OpenTaint', rules: [] } },
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
  dir = mkdtempSync(join(tmpdir(), 'cli-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'rules'), { recursive: true });
  writeFileSync(join(dir, 'src', 'A.java'), 'class A {}');
  writeFileSync(join(dir, 'rules', 'xss.yaml'), 'id: xss-in-spring-app\n');
  // %SRCROOT% points at the temp project root so the source resolves from the SARIF
  sarif.runs[0].originalUriBaseIds['%SRCROOT%'].uri = dir;
  writeFileSync(join(dir, 'report.sarif'), JSON.stringify(sarif));
  writeFileSync(join(dir, 'template.html'),
    `<html><head></head><body><script type="application/json" id="opentaint-content">${CONTENT_PLACEHOLDER}</script></body></html>`);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('opentaint-viewer export', () => {
  it('writes an HTML report with the findings injected, source root taken from the SARIF', () => {
    const out = join(dir, 'report.html');
    execFileSync('npx', ['tsx', 'src/cli/main.ts', 'export',
      '--sarif', join(dir, 'report.sarif'),
      '--rules', join(dir, 'rules'),
      '--out', out,
    ], { stdio: 'pipe', env: { ...process.env, OPENTAINT_VIEWER_TEMPLATE: join(dir, 'template.html') } });

    const html = readFileSync(out, 'utf8');
    expect(html).not.toContain(CONTENT_PLACEHOLDER);
    const json = html.replace(/^[\s\S]*id="opentaint-content">/, '').replace(/<\/script>[\s\S]*$/, '');
    const content = JSON.parse(json);
    expect(content.findings).toHaveLength(1);
    expect(content.files.map((f: { path: string }) => f.path)).toEqual(['src/A.java']);
    expect(content.projectId).toBe(basename(dir)); // name defaults to basename of the SARIF source root
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/cli/main.test.ts`
Expected: FAIL — `src/cli/main.ts` does not exist.

- [ ] **Step 3: Implement `main.ts`**

`src/cli/main.ts`:

```ts
#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseArgs } from './args';
import { generateContent } from './generateContent';
import { resolveSourceRoot, resolveRulesDir } from './resolve';
import { injectContent } from './render';
import { loadTemplate } from './template';
import { serve } from './serve';
import type { ViewerContent } from '../types/content';

const USAGE = `opentaint-viewer <serve|export> --sarif <file> [options]

  --sarif <file>   SARIF report (required)
  --src <dir>      source root (default: SARIF %SRCROOT%, else the SARIF's directory)
  --rules <dir>    ruleset dir (default: ../lib/rules relative to the CLI)
  --name <id>      project name shown in the UI (default: basename of source root)

serve:   --port <n> (default 5151)   --no-open
export:  --out <file> (default opentaint-report.html)`;

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function str(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function buildContent(args: Record<string, string | boolean>, cliUrl: string): ViewerContent {
  const sarifPath = str(args.sarif);
  if (!sarifPath) fail('--sarif is required\n\n' + USAGE);
  if (!existsSync(sarifPath)) fail(`--sarif not found: ${sarifPath}`);

  const sarifLog = JSON.parse(readFileSync(sarifPath, 'utf8'));
  const srcRoot = resolveSourceRoot(sarifLog, sarifPath, str(args.src));
  const rulesDir = resolveRulesDir(cliUrl, str(args.rules));
  if (!existsSync(rulesDir)) fail(`rules dir not found: ${rulesDir} (pass --rules <dir>)`);

  const projectId = str(args.name) ?? basename(srcRoot);
  const content = generateContent({ sarifLog, srcDir: srcRoot, root: srcRoot, rulesDir, projectId });

  const referenced = new Set(content.findings.flatMap((f) => f.flows.flatMap((fl) => fl.steps.map((s) => s.file))));
  if (referenced.size > 0 && content.files.length === 0) {
    fail(`no source files found under ${srcRoot}; pass --src <dir>`);
  }
  return content;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== 'serve' && command !== 'export') {
    console.error(USAGE);
    process.exit(command ? 1 : 0);
  }
  const args = parseArgs(rest);
  const content = buildContent(args, import.meta.url);
  const html = injectContent(loadTemplate(import.meta.url), content);

  if (command === 'export') {
    const out = resolve(str(args.out) ?? 'opentaint-report.html');
    writeFileSync(out, html);
    console.log(`Wrote ${out}: ${content.findings.length} findings, ${content.files.length} files`);
    return;
  }
  await serve(html, {
    port: str(args.port) ? Number(str(args.port)) : 5151,
    open: args.open !== false,
  });
}

main().catch((err) => {
  console.error('opentaint-viewer failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/cli/main.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: PASS (all existing + new tests).

- [ ] **Step 6: Commit**

```bash
git add src/cli/main.ts src/cli/main.test.ts
git commit -m "feat: add opentaint-viewer serve/export CLI entry"
```

---

## Task 9: Template build mode (Vite)

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add the `template` mode to `vite.config.ts`**

Replace `vite.config.ts` with:

```ts
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const CONTENT_PLACEHOLDER = '__OPENTAINT_CONTENT__';
const STUB = fileURLToPath(new URL('./src/content/bundledContent.stub.ts', import.meta.url));

/** In `template` mode, drop in the empty content <script> the CLI fills per report. */
function injectContentPlaceholder(): Plugin {
  return {
    name: 'opentaint-content-placeholder',
    transformIndexHtml(html) {
      return html.replace(
        '</body>',
        `<script type="application/json" id="opentaint-content">${CONTENT_PLACEHOLDER}</script></body>`,
      );
    },
  };
}

/** In `template` mode, swap the demo content import for the null stub so the
 * ~0.5 MB demo is not shipped inside the CLI template. */
function stubBundledContent(): Plugin {
  return {
    name: 'opentaint-stub-bundled-content',
    enforce: 'pre',
    resolveId(source) {
      if (source === './bundledContent' || source.endsWith('/content/bundledContent')) {
        return STUB;
      }
      return null;
    },
  };
}

// `--mode singlefile` and `--mode template` both inline everything into one HTML file.
// `template` additionally stubs the demo content and injects the CLI's content placeholder.
export default defineConfig(({ mode }) => {
  const singlefile = mode === 'singlefile' || mode === 'template';
  return {
    plugins: [
      react(),
      ...(singlefile ? [viteSingleFile()] : []),
      ...(mode === 'template' ? [stubBundledContent(), injectContentPlaceholder()] : []),
    ],
  };
});
```

- [ ] **Step 2: Build the template**

Run: `npx vite build --mode template --outDir dist-template --emptyOutDir`
Expected: writes `dist-template/index.html` (one self-contained file).

- [ ] **Step 3: Verify the placeholder is present and the demo content is NOT**

Run: `node -e "const h=require('node:fs').readFileSync('dist-template/index.html','utf8'); if(!h.includes('__OPENTAINT_CONTENT__')) throw new Error('placeholder missing'); if(h.includes('java-spring-demo')) throw new Error('demo content leaked into template'); console.log('template OK', h.length, 'bytes')"`
Expected: prints `template OK <n> bytes`.

- [ ] **Step 4: End-to-end through the real template** — run `export` against the committed fixture with the freshly built template, confirm it renders

Run:
```bash
mkdir -p /tmp/otv-src && printf 'class A {}' > /tmp/otv-src/A.java
OPENTAINT_VIEWER_TEMPLATE=dist-template/index.html npx tsx src/cli/main.ts export \
  --sarif fixtures/sample.sarif --src /tmp/otv-src --rules /tmp/otv-src --out /tmp/otv-report.html
node -e "const h=require('node:fs').readFileSync('/tmp/otv-report.html','utf8'); if(h.includes('__OPENTAINT_CONTENT__')) throw new Error('placeholder not filled'); console.log('report OK', h.length, 'bytes')"
```
Expected: `report OK <n> bytes` (placeholder replaced; `<n>` is multi-MB because Monaco is inlined).

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add template Vite build mode (stub demo, inject content placeholder)"
```

---

## Task 10: Packaging — `bin`, build scripts, template copy

**Files:**
- Modify: `package.json`, `.gitignore`
- Create: `scripts/copy-template.mjs`

- [ ] **Step 1: Add the template-copy script**

`scripts/copy-template.mjs`:

```js
// Copy the built template next to the CLI bundle and mark the bundle executable.
import { copyFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';

if (!existsSync('dist-template/index.html')) {
  throw new Error('dist-template/index.html missing; run `npm run build:template` first');
}
if (!existsSync('dist-cli/opentaint-viewer.js')) {
  throw new Error('dist-cli/opentaint-viewer.js missing; run `npm run build:cli` first');
}
mkdirSync('dist-cli/template', { recursive: true });
copyFileSync('dist-template/index.html', 'dist-cli/template/index.html');
chmodSync('dist-cli/opentaint-viewer.js', 0o755);
console.log('Packaged CLI: dist-cli/opentaint-viewer.js + dist-cli/template/index.html');
```

- [ ] **Step 2: Add `esbuild`, the `bin`, and build scripts to `package.json`**

In `package.json`, add a `bin` field (after `"type": "module",`):

```json
  "bin": {
    "opentaint-viewer": "dist-cli/opentaint-viewer.js"
  },
```

Add these entries to `"scripts"`:

```json
    "cli": "tsx src/cli/main.ts",
    "build:template": "tsc --noEmit && vite build --mode template --outDir dist-template --emptyOutDir",
    "build:cli": "esbuild src/cli/main.ts --bundle --platform=node --format=esm --target=node20 --outfile=dist-cli/opentaint-viewer.js --banner:js=\"#!/usr/bin/env node\"",
    "build:dist": "npm run build:template && npm run build:cli && node scripts/copy-template.mjs",
```

Add `esbuild` to `"devDependencies"`:

```json
    "esbuild": "^0.24.0",
```

- [ ] **Step 3: Ignore the build outputs**

Append to `.gitignore`:

```
dist-template
dist-cli
```

- [ ] **Step 4: Install esbuild**

Run: `npm install`
Expected: esbuild added, lockfile updated, no errors.

- [ ] **Step 5: Build the full CLI distribution**

Run: `npm run build:dist`
Expected: ends with `Packaged CLI: dist-cli/opentaint-viewer.js + dist-cli/template/index.html`.

- [ ] **Step 6: Smoke-test the bundled CLI (no tsx, resolves its own template)**

Run:
```bash
node dist-cli/opentaint-viewer.js export \
  --sarif fixtures/sample.sarif --src /tmp/otv-src --rules /tmp/otv-src --out /tmp/otv-bundle.html
node -e "const h=require('node:fs').readFileSync('/tmp/otv-bundle.html','utf8'); if(h.includes('__OPENTAINT_CONTENT__')) throw new Error('not filled'); if(!h.includes('xss-in-spring-app')) throw new Error('finding missing'); console.log('bundle OK')"
```
Expected: `bundle OK` — the bundle found `dist-cli/template/index.html` via `import.meta.url` and injected the fixture's finding, with no `--rules`-relative `../lib/rules` needed because `--rules` was passed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore scripts/copy-template.mjs
git commit -m "build: package opentaint-viewer CLI (bin, template bundle, esbuild)"
```

---

## Task 11: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a CLI section to `README.md`**

Insert a new section after "## Generate a static HTML report for your project" (before "## Try the bundled demo"):

```markdown
## Use the `opentaint-viewer` CLI

Once installed alongside the engine, point the CLI at a SARIF and either view it
or write a self-contained report. The source root is read from the SARIF's
`%SRCROOT%` (falling back to the report's directory), and the ruleset defaults to
`../lib/rules` next to the CLI — so the common case needs only `--sarif`:

```bash
# Open the report in a browser (localhost)
opentaint-viewer serve  --sarif results.sarif

# Write a self-contained offline HTML report
opentaint-viewer export --sarif results.sarif --out report.html
```

Override the defaults when needed:

| Option | Default | Meaning |
| --- | --- | --- |
| `--sarif <file>` | — (required) | SARIF report. |
| `--src <dir>` | SARIF `%SRCROOT%`, else the SARIF's directory | Source root. |
| `--rules <dir>` | `../lib/rules` relative to the CLI | Ruleset directory. |
| `--name <id>` | basename of the source root | Project name in the UI. |
| `--port <n>` (serve) | `5151` | Listen port. |
| `--no-open` (serve) | — | Don't auto-open the browser. |
| `--out <file>` (export) | `opentaint-report.html` | Output HTML path. |

The build-from-scratch path below (`npm run gen` + `npm run build:single`) still
works and is used to regenerate the committed demo.
```

- [ ] **Step 2: Add the new scripts to the Scripts table in `README.md`**

In the "## Scripts" table, add these rows after the `npm run build` row:

```markdown
| `npm run cli` | Run the CLI from source via tsx (`npm run cli -- export --sarif …`). |
| `npm run build:dist` | Build the CLI bundle + template into `dist-cli/` (the shippable CLI). |
```

- [ ] **Step 3: Verify the build still passes type-checking**

Run: `npm run build`
Expected: `tsc --noEmit` passes and the hosted `dist/` build succeeds (the demo path is unaffected).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document the opentaint-viewer serve/export CLI"
```

---

## Final verification

- [ ] **Step 1: Full unit suite**

Run: `npm test`
Expected: PASS — including the new `src/cli/*` tests and the unchanged `scripts/gen-content.test.ts`.

- [ ] **Step 2: E2E suite (demo path unchanged)**

Run: `npm run e2e`
Expected: PASS — the committed demo still renders via the bundled-content fallback.

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS.

---

## Notes for the implementer

- **TDD order matters:** Task 1 must land first — every later task assumes `loadContent()` reads injected content. The demo/dev/test path always survives because `injectedContent()` returns `undefined` when there's no `#opentaint-content` element.
- **Why `<` → `<`:** structural JSON never contains `<`; it only appears inside string values (e.g. Java generics, XML rules), where `<` is a valid in-string escape that `JSON.parse` restores. This is what stops a `</script>` in source code from breaking out of the inline `<script>`.
- **`--root` is intentionally not a CLI flag.** SARIF URIs are relative to `%SRCROOT%`, so the CLI sets `srcDir === root === <source root>`. The `root` parameter still exists in `generateContent` for the legacy `scripts/gen-content.ts` (`--src` points at `proj/src`, `root` defaults to its parent).
- **Node-environment tests:** files that touch `node:http`, `node:fs`, or spawn `tsx` start with `// @vitest-environment node` so they don't run under jsdom.
```
