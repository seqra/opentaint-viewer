# OpenTaint Viewer

An in-browser, VS Code–style viewer for exploring [OpenTaint](https://opentaint.org/)
taint-analysis results. It ships with the pre-analyzed findings for a real
Spring application ([`seqra/java-spring-demo`](https://github.com/seqra/java-spring-demo))
so you can click through vulnerabilities, trace each tainted data flow from source
to sink, and read the rules that fired — all without installing anything.

The viewer is **fully static**: there is no backend. Analysis results are
computed ahead of time by a real OpenTaint engine run and committed as a bundled
content artifact, so the whole experience is instant and works offline.

## Features

- **Findings & Rules trees** — a VS Code activity bar switches the left sidebar
  between the findings tree (grouped by directory, with severity dots) and the
  ruleset tree (built-in vs. custom rules).
- **Monaco code editor** with taint-path decorations: the flow is highlighted in
  blue, the sink in red. Jump step-by-step through the path; cross-file hops switch
  the active file automatically.
- **Finding info panel** — rule description (markdown), CWE tags, severity, and the
  ordered list of taint steps (source → propagation → sanitizer → sink).
- **Flexible layout** — toggle the editor and info panel between tabbed and
  side-by-side split views; resizable panels throughout.
- **Light/dark theme** with brand-matched Monaco themes (`ot-light` / `ot-dark`) and
  JetBrains Mono.
- **View persistence** — your selected finding, step, files, and layout are saved to
  `localStorage` and restored on refresh.
- **Offline single-file export** — build a single self-contained `index.html`
  (JS, CSS, fonts, and Monaco all inlined).

The bundled demo covers **13 findings** — Template Injection, SSRF (Kotlin), and XSS —
over the source files they reference and **47 rules**.

## Quick start

```bash
npm install
npm run dev        # start the Vite dev server
```

Then open the URL Vite prints (default http://localhost:5173).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR. |
| `npm run build` | Type-check (`tsc --noEmit`) and build to `dist/`. |
| `npm run build:single` | Build a single self-contained offline `index.html` into `dist-single/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the unit/component test suite (Vitest) once. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run coverage` | Vitest with V8 coverage. |
| `npm run e2e` | Playwright end-to-end tests. |
| `npm run gen` | Regenerate `data/content.json` from a SARIF + source dir + rules dir (see below). |

## How it works

The app loads a single bundled content file and renders everything from it — there
are no network calls for analysis.

```
data/content.json   ← committed, pre-analyzed content
        │
        ▼
loadContent()  →  validate (isViewerContent)  →  Zustand store  →  UI
```

The content shape is defined in [`src/types/content.ts`](src/types/content.ts):

- `tool` — the analyzer name and version (semver + build) read from the SARIF.
- `findings` — each with a rule id, vuln class, severity, CWE tags, markdown
  description, primary location, code flows, and ordered `TaintStep`s.
- `files` — the project source files referenced by findings.
- `rules` — the ruleset (`builtin` or `custom`), keyed by their real ruleset-relative
  path so findings can link straight to the rule that defined them.

State lives in a single [Zustand store](src/state/store.ts). The persisted slice (the
*view* — selected finding/step/files and layout, not the bundled content) is written to
`localStorage` under `ot-view` and validated on rehydrate so stale or corrupt storage
can't render an invalid view.

## Project structure

```
src/
  components/   UI: AppShell, TopBar, ActivityBar, trees, EditorArea, InfoPanel, ...
  content/      bundled content + loader/validation
  pipeline/     SARIF → content transform (sarif.ts)
  rules/        rule line/ref helpers
  state/        Zustand store + theme
  taint/        taint-path decorations + step navigation
  types/        content type model + guard
  util/         path, tree, severity, file-tab helpers
scripts/
  gen-content.ts     generates data/content.json from a SARIF + source + rules
e2e/                 Playwright specs
fixtures/            sample SARIF for tests
```

## Customizing for your own project

The viewer renders a single committed `data/content.json`. To point it at a different project:

1. **Produce a SARIF** by running OpenTaint on your project (see the OpenTaint CLI). You'll
   have a SARIF report, your project's source directory, and the ruleset directory you scanned with.
2. **Generate the content** (one command):
   ```bash
   npm run gen -- --sarif <report.sarif> --src <source-dir> --rules <rules-dir> [--name <project-id>]
   ```
   This writes `data/content.json`: the findings, the source files they reference (pruned to
   only those), the full ruleset, and the analyzer name/version read from the SARIF.
3. **Ship it** — either deploy the hosted build (`npm run build` → `dist/`) or produce a single
   fully-offline file (`npm run build:single` → `dist-single/index.html`).

## Testing

- **Unit/component:** [Vitest](https://vitest.dev/) + Testing Library + jsdom
  (`npm test`, coverage via `npm run coverage`). Tests live next to the code they cover.
- **End-to-end:** [Playwright](https://playwright.dev/) (`npm run e2e`). The smoke test
  derives its expectations from the committed content so it survives a `gen` run.

CI (`.github/workflows/ci.yml`) runs the build, coverage, and Playwright suite on every
push to `main` and on pull requests.

## Tech stack

React 18 · TypeScript · Vite · Monaco Editor · Zustand · react-resizable-panels ·
Lucide icons · JetBrains Mono.

## Learn more

- OpenTaint: <https://opentaint.org/>
- Engine & CLI: <https://github.com/seqra/opentaint>
- Demo project analyzed here: <https://github.com/seqra/java-spring-demo>
