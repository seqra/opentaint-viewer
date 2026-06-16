<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/opentaint-header-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="src/assets/opentaint-header-light.svg">
    <img src="src/assets/opentaint-header-light.svg" alt="OpenTaint" height="40">
  </picture>
</p>

<h3 align="center">In-browser, VS Code–style viewer for taint-analysis results</h3>

<p align="center">
  Point it at an <a href="https://opentaint.org/">OpenTaint</a> SARIF and get a self-contained, offline HTML report — click through findings, trace each tainted flow from untrusted input to dangerous call, and read the rules that fired, all without a server.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@seqra/opentaint-viewer"><img src="https://img.shields.io/npm/v/@seqra/opentaint-viewer.svg" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="Node >= 20"></a>
  <a href="https://github.com/seqra/opentaint-viewer/actions/workflows/ci.yml"><img src="https://github.com/seqra/opentaint-viewer/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/viewer-light.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/viewer-dark.png">
    <img alt="OpenTaint Viewer — a stored-XSS finding selected, the tainted path highlighted from untrusted input to dangerous call, and the ordered steps listed below" src="docs/screenshots/viewer-dark.png">
  </picture>
</p>

---

## Why

- **Trace taint end to end.** A Monaco editor highlights the flow in blue and the dangerous call in red; step through it from untrusted input to dangerous call, with cross-file hops switching the active file for you.
- **Findings and rules, side by side.** VS Code–style trees group findings by directory and list the ruleset; open a finding to read the rule that fired — markdown description, CWE tags, severity, and ordered taint steps.
- **Offline, single file.** Export one self-contained `index.html` — JS, CSS, fonts, and Monaco all inlined. No server, no network. Share it as-is.

## Quick Start

Generate a report from an OpenTaint SARIF — no install required (`npx` fetches the CLI on demand):

```bash
# Open the report in your browser
npx @seqra/opentaint-viewer serve --sarif results.sarif

# Or write a self-contained, offline HTML file
npx @seqra/opentaint-viewer export --sarif results.sarif --out report.html
```

Prefer a global command? `npm install -g @seqra/opentaint-viewer`, then run `opentaint-viewer serve --sarif results.sarif`.

The builtin ruleset is found next to the `opentaint` engine binary on your `PATH`, and the
source root is read from the SARIF — so the common case needs only `--sarif`. No SARIF yet?
[Run OpenTaint](https://github.com/seqra/opentaint#quick-start) to produce one.

<details>
<summary><b>CLI options</b></summary>

Add `--rules ./my-rules` to show your project's custom rules alongside the builtin set.

| Option | Default | Meaning |
| --- | --- | --- |
| `--sarif <file>` | — (required) | SARIF report. |
| `--src <dir>` | SARIF `%SRCROOT%`, else the SARIF's directory | Source root. |
| `--builtin-rules <dir>` | `../lib/rules` next to the `opentaint` binary on `PATH`, else next to the CLI | Builtin ruleset directory (the engine's shipped rules). |
| `--rules <dir>` | — (optional) | Your project's custom rules; shown under "Custom" and linked from findings. Custom wins on an id collision with a builtin rule. A rule in neither set still renders, marked "definition not available". |
| `--name <id>` | basename of the source root | Project name in the UI. |
| `--port <n>` (serve) | `5151` | Listen port. |
| `--no-open` (serve) | — | Don't auto-open the browser. |
| `--out <file>` (export) | `opentaint-report.html` | Output HTML path. |

Run the engine only through Docker? Extract its ruleset once and pass `--builtin-rules ./rules` —
see the [OpenTaint quick-start](https://github.com/seqra/opentaint#quick-start) for the Docker invocation.
</details>

## Try the demo

Have OpenTaint installed? Scan the [`seqra/java-spring-demo`](https://github.com/seqra/java-spring-demo)
project and open the report — `npx` fetches the viewer, nothing to install:

```bash
git clone https://github.com/seqra/java-spring-demo
opentaint scan --output java-spring-demo/results.sarif java-spring-demo

# Open it in the browser
npx @seqra/opentaint-viewer serve --sarif java-spring-demo/results.sarif
# Or write a shareable offline file
npx @seqra/opentaint-viewer export --sarif java-spring-demo/results.sarif --out report.html
```

> Just want to preview the UI? The repo commits a demo `data/content.json` —
> **13 findings** (Template Injection, SSRF, XSS) over **47 rules** — rendered by the dev
> server: `npm install && npm run dev`.

<details>
<summary><b>Build a static report from source (<code>npm run gen</code>)</b></summary>

The viewer is a generic React app that renders one committed `data/content.json`. The CLI above
is the easy path; this build-from-scratch flow regenerates the committed demo and works for any project:

```bash
npm install
npm run gen -- \
  --sarif your-project/results.sarif \
  --src   your-project/src \
  --rules "$(dirname "$(command -v opentaint)")/../lib/rules" \
  --name  your-project
npm run build:single   # writes a self-contained dist-single/index.html; use npm run build for a hosted dist/ build
```

> In this legacy `npm run gen` workflow, `--rules` is the *builtin* ruleset — it predates the CLI's
> flag split (`--builtin-rules` builtin, `--rules` custom). If your SARIF `artifactLocation.uri`
> values aren't relative to the parent of `--src`, pass `--root <dir>`.
</details>

<details>
<summary><b>Development</b></summary>

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR. |
| `npm run cli` | Run the CLI from source via tsx (`npm run cli -- export --sarif results.sarif --out report.html`). |
| `npm run gen` | Generate `data/content.json` from a SARIF + source + rules. |
| `npm run build:single` | Build a single self-contained offline `index.html` into `dist-single/`. |
| `npm run build` | Type-check (`tsc --noEmit`) and build the hosted site to `dist/`. |
| `npm run build:dist` | Build the shippable CLI bundle + template into `dist-cli/`. |
| `npm test` / `npm run coverage` | Vitest unit/component tests (+ V8 coverage). |
| `npm run e2e` | Playwright end-to-end tests. |

**Stack:** React 18 · TypeScript · Vite · Monaco Editor · Zustand · react-resizable-panels ·
Lucide · JetBrains Mono. The viewer is fully static — it loads one bundled `data/content.json`
(shape in [`src/types/content.ts`](src/types/content.ts)) into a [Zustand store](src/state/store.ts)
and renders everything from it; no backend, no network calls for analysis. CI
([`ci.yml`](.github/workflows/ci.yml)) runs the build, coverage, and Playwright suite on every push and PR.
</details>

## Learn more

- OpenTaint engine & CLI — <https://github.com/seqra/opentaint>
- Demo project analyzed here — <https://github.com/seqra/java-spring-demo>

## License

[MIT](LICENSE)
