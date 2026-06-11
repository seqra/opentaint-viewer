# OpenTaint Viewer CLI — `serve` and `export`

**Status:** Approved design (2026-06-11)

## Problem

The viewer is a static Vite/React app that bakes a single `data/content.json`
into its bundle at build time (`loadContent()` does `import raw from
'../../data/content.json'`). Producing a report for a real project today means
running `scripts/gen-content.ts` to overwrite `data/content.json`, then a full
`vite build`. There is no way for an end user to point a command at a SARIF and
get a report.

We want a CLI that does two things from one analysis:

1. **`serve`** — start a local server that renders the report and opens a browser.
2. **`export`** — write a self-contained static HTML report to a file.

With three "by default" conveniences:

- **Source root** defaults to what the SARIF already carries.
- **Rules dir** defaults to `../lib/rules` relative to the CLI (the native install layout).
- **Project name** defaults to the basename of the resolved source root.

## What the SARIF actually carries

OpenTaint SARIF puts the source root in
`run.originalUriBaseIds["%SRCROOT%"].uri`, and every artifact URI is relative to
it (`uriBaseId: "%SRCROOT%"`). Observed across real reports:

| Report | `%SRCROOT%` |
| --- | --- |
| java-spring-demo (Docker) | `/project/` |
| BenchmarkJava (native) | `/Users/dvvrd/dev/seqra/test-projects/BenchmarkJava/` |
| Stirling-PDF (native) | `/home/misonijnik/.../sources/` |
| seqra CI | `/__w/_temp/seqra-artifacts/.../sources/` |
| results.sarif / WebGoat / log4j | **absent** |

Conclusion: the embedded root is reliable for the **native install case** (scan,
then view on the same machine), but it is meaningless under Docker/CI/another
machine, and is sometimes missing entirely. The resolver must use it **only when
it exists on disk** and fall back gracefully otherwise. Artifact URIs are always
relative to `%SRCROOT%`, so the source root is the single base for both walking
files and matching URIs (no separate `--root` needed in the common case).

## Decisions (from brainstorming)

- **Runtime model:** prebuilt template + runtime injection. The package build
  produces one single-file HTML template once; the CLI fills it per report. No
  Vite/tsc/`node_modules` at runtime.
- **Distribution:** bundled inside the native opentaint install tree
  (`<prefix>/bin/<cli>`, `<prefix>/lib/rules`). Rules default resolves relative
  to the CLI executable.
- **Source root default:** read from the SARIF's `%SRCROOT%`, used only if it
  exists on disk; otherwise fall back.
- **`serve` output:** the same injected single-file HTML as `export`, served over
  localhost (not a multi-file dev bundle).
- **Command names:** `serve` / `export` (avoids clashing with the existing Vite
  `build` / `build:single` scripts).

## Command surface

```
opentaint-viewer serve  --sarif <file> [--src <dir>] [--rules <dir>] [--name <id>] [--port <n>] [--no-open]
opentaint-viewer export --sarif <file> [--src <dir>] [--rules <dir>] [--name <id>] [--out <file>]
```

Shared options:

- `--sarif <file>` — SARIF report. **Required.**
- `--src <dir>` — source root. Default: resolved from SARIF (see below).
- `--rules <dir>` — ruleset dir. Default: `../lib/rules` relative to the CLI.
- `--name <id>` — project name shown in the UI. Default: basename of source root.

`serve` only:

- `--port <n>` — listen port. Default: `5151` (distinct from Vite's `5173`),
  falling back to the first free port above it if taken.
- `--no-open` — do not auto-open the browser.

`export` only:

- `--out <file>` — output HTML path. Default: `opentaint-report.html` in the CWD.

## Default resolution

**Source root** (`--src` overrides):

1. `originalUriBaseIds["%SRCROOT%"].uri` from the SARIF — used **only if it
   exists on disk**.
2. else the directory containing the `--sarif` file.
3. If neither locates the files referenced by findings, fail with:
   *"couldn't locate sources; pass `--src <dir>`."*

The chosen root is used both as the directory to walk for source files and as
the base that relative artifact URIs are matched against (they are equal because
URIs are relative to `%SRCROOT%`).

**Rules dir** (`--rules` overrides): `../lib/rules` resolved relative to the CLI
executable's own location (`import.meta.url`). If absent, fail with a clear
message naming the path it tried.

**Project name** (`--name` overrides): basename of the resolved source root.

## Runtime model and content injection

The package build emits a **single prebuilt HTML template** (Monaco, JS, CSS,
fonts inlined via `vite-plugin-singlefile`) containing a content placeholder. At
runtime the CLI parses the SARIF, collects sources and rules, builds the
`ViewerContent` object, and injects it into the template.

Injection mechanism: a `<script type="application/json" id="opentaint-content">`
element carrying `JSON.stringify(content)` with `</` escaped to `<\/` (and the
U+2028/U+2029 line separators escaped) so it is safe inside HTML.

`loadContent()` precedence becomes:

1. parse `#opentaint-content` JSON if present (injected report),
2. else the bundled demo `data/content.json` (dev server + committed demo + tests),
3. else throw.

This keeps `npm run dev`, the committed demo, and every existing test working
unchanged — they all hit the fallback.

To keep the ~0.5 MB demo `content.json` **out** of the CLI template, the static
JSON import is isolated in `src/content/bundledContent.ts` and aliased to a null
stub (`bundledContent.stub.ts`) in a new `template` Vite build mode. The template
therefore ships empty and is filled per report.

## Components

New and refactored modules:

```
src/cli/
  generateContent.ts   pure: (sarifLog, srcRoot, rulesDir, name) -> ViewerContent
                        (logic extracted from scripts/gen-content.ts;
                         reuses src/pipeline/sarif.ts transformSarif/toolInfo)
  resolve.ts           resolveSourceRoot(sarifLog, sarifPath, srcArg)
                       resolveRulesDir(cliUrl, rulesArg)
  render.ts            injectContent(templateHtml, content) -> html string
  serve.ts             node:http server returning the injected HTML + open browser
  main.ts              arg parsing + serve/export dispatch (the bin entry, shebang)
src/content/
  bundledContent.ts        static import of data/content.json (demo)
  bundledContent.stub.ts   null stub, aliased in `template` build mode
  loadContent.ts           injected JSON -> bundledContent -> throw
```

- `scripts/gen-content.ts` remains for the legacy `npm run gen`, but delegates to
  `generateContent.ts` so there is no duplicated collection logic.
- The CLI is bundled to a single self-contained JS file (with a shebang) plus the
  template asset copied beside it; it locates the template via `import.meta.url`.
- `vite.config.ts` gains a `template` mode: single-file output + the JSON-import
  alias to the stub + the content placeholder.

## Data flow

```
serve/export
  -> resolveSourceRoot(sarif) + resolveRulesDir(cli)
  -> generateContent(sarifLog, srcRoot, rulesDir, name)   [validate: isViewerContent]
  -> injectContent(template, content)
  -> write file (export)   OR   http server + open browser (serve)
```

## Error handling

Fail fast with actionable, user-facing messages:

- missing `--sarif`, or a path that does not exist;
- source root cannot be resolved / referenced files not found → suggest `--src`;
- rules dir missing → name the path tried, suggest `--rules`;
- generated content fails `isViewerContent` → contract error (internal bug).

No silent fallbacks that produce an empty report.

## Testing

- **Unit:**
  - `resolveSourceRoot` — SRCROOT present-and-exists, present-but-missing, absent
    (each with the expected fallback);
  - `resolveRulesDir` — explicit override vs. `../lib/rules` from CLI url;
  - `injectContent` — `</script>` escaping and JSON round-trips back to the
    original content;
  - `generateContent` — reuse/port the existing `scripts/gen-content.test.ts`.
- **Integration/E2E:** run `export` against `fixtures/sample.sarif` + a temporary
  source tree + temporary rules dir; assert the output HTML parses the injected
  findings back out. Assert the existing demo/dev render path still works.

## Out of scope (YAGNI)

- Standalone npm / `npx` distribution and an `OPENTAINT_RULES` env fallback (the
  chosen distribution is bundled-in-install; a single `../lib/rules` default is
  enough).
- A multi-file `serve` bundle or live source re-reading; `serve` reuses the
  single-file HTML.
- Watch mode / re-analysis; the CLI consumes an existing SARIF only.
