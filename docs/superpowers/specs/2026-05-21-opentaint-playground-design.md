# OpenTaint Playground — Design Spec

**Date:** 2026-05-21
**Status:** Approved for planning
**Engine under glass:** [seqra/opentaint](https://github.com/seqra/opentaint) — open-source taint-analysis engine for Java/Kotlin (Spring Boot), runs at bytecode level, outputs SARIF.

---

## 1. Summary

A hosted, zero-friction web playground that lets a developer or security engineer experience
opentaint finding a *real, cross-file* vulnerability within seconds — then edit the code or the
rules, re-run, and watch the finding change — without installing anything. The playground runs the
**unmodified** opentaint engine so the experience is credible, and ends every path with a clear next
step (install the CLI / add the GitHub Action).

## 2. Primary goal & success metrics

**Primary goal:** adoption funnel / growth. When priorities collide, optimize for *instant wow + a
clear next step*, not breadth or configurability.

**Success metrics (in rough priority order):**
- CLI installs / GitHub Action additions attributable to the playground (tracked via the CTA links).
- Repo stars from playground referrals.
- Share-link creations and opens (virality).
- Time-to-first-finding on landing (target: finding visible on first paint, < 1s).
- Edit → Run conversion (share of visitors who run at least one live scan).

**Non-goals:** being a full IDE, supporting arbitrary user projects, replacing the CLI, or covering
every one of opentaint's 20+ vulnerability classes at launch.

## 3. Audience

Primary: backend/full-stack developers and AppSec engineers evaluating modern SAST. Secondary:
people who arrive from a shared link or a conference talk. All anonymous — **no accounts in v1.**

## 4. The core constraint (why the architecture looks the way it does)

opentaint is **not** a snippet analyzer. It requires a full buildable Gradle/Maven project, resolves
dependencies (the Spring Boot ecosystem), compiles to bytecode, and runs whole-program
inter-procedural dataflow analysis — taking **seconds to minutes** of CPU. This is the source of its
value (true cross-file, cross-layer taint tracking) and it directly fights "paste a snippet, instant
result." The design reconciles the two with **two execution paths** (§7).

A consequence the design honors: **a code edit invalidates the compiled model and requires a
recompile** before scanning. A **rule-only edit** does not touch code and can reuse the compiled
model.

## 5. Core experience (locked layout)

A single-screen IDE-style app:

- **Top bar:** example selector · **Run scan** · **Install the CLI →** (the funnel CTA, always
  present).
- **Left sidebar — two trees:**
  - **Findings** — each finding (e.g. `🔴 SQL Injection · GET /users/search`) expands into its
    ordered **taint-path steps**. Selecting a step drives the inline highlight and jumps to the right
    file/line. Each finding names the rule that produced it (bi-directional link to the Rules tree).
  - **Rules** — the spec **directory**, organized only by origin: **Builtin** and **Custom**. Each
    origin contains three spec kinds: **rules**, **passthrough approximations**, **dataflow
    approximations**. (No framework grouping.) Custom can hold user-authored specs of all three
    kinds. Selecting any spec opens it in the Rules editor.
- **Right — editor area** with two views, **Code** and **Rules**, that can be **tabbed** (one at a
  time) or **split** side-by-side via a `⊟ tabs / ⊞ split` toggle.
  - **Code** view has inner file tabs (multi-file project) with the **taint path rendered inline**:
    green source ①, amber intermediate hops ②③, red sink ④, plus a `→ OtherFile.java` marker on the
    hop that crosses files. The narrative lives *in the code*, not in a separate prose panel.
  - **Rules** view edits the selected spec (taint-mode YAML: `mode`, `sources`, `propagators`,
    `sanitizers`, `sinks`).

## 6. Content model

- **Seed project:** [seqra/java-spring-demo](https://github.com/seqra/java-spring-demo) — a
  deliberately-vulnerable Spring Boot 3.3 app (Java 21 + Kotlin, Gradle Kotlin DSL, Thymeleaf/
  FreeMarker, JPA, H2). It already ships an `opentaint.yml` GitHub Action. It contains rich flows:
  XSS complexity chains, JPA save/load taint, async SSRF via Kotlin coroutines, DI/cross-function
  indirect flows.
- **Examples = curated "scenarios"** that are focused entry points into this one project. Each
  scenario pins a starting file, a default selected finding, and a short framing blurb. The full
  project (file tree + all findings) is browsable from any scenario.
- **Rules content:** opentaint's builtin ruleset (`rules/ruleset/java/security/*.yaml` and `lib`
  components) loaded read-but-forkable; "Custom" starts empty with `+ new`.

## 7. Architecture & data flow

Two paths share the same SPA.

### Instant read path (🟩 static, cheap, always-on)
At **build time**, run opentaint on `java-spring-demo` once and cache the outputs as **static JSON on
a CDN**: SARIF findings, the project's source files, the per-finding **dataflow steps**, and the base
rules. The first paint shows a real finding with **zero wait**. The common case (just looking) never
touches a backend.

### Live re-run path (🟧 sandboxed, warm)
On **Run scan**:
1. **Scan API (stateless)** validates the request — edits confined to existing project file paths, no
   new dependencies or build-script changes — applies per-IP rate limits and a job timeout, and
   **classifies** the request as *code edit* vs *rule-only*.
2. **Warm worker pool** — ephemeral containers from the real `ghcr.io/seqra/opentaint:latest` image,
   pre-seeded so deps are already `pull`ed, the JVM/Gradle daemon is hot, and the base project model
   is `compile`d. Autoscales to zero when idle.
   - **Code edit →** recompile the project model (`compile`) → `scan` → SARIF. *(seconds–minutes)*
   - **Rule-only edit →** reuse the compiled model → re-run analysis only → SARIF. *(fast)*
3. SARIF + dataflow steps return to the SPA and render inline.

### Permalink store (🟦 edge KV)
Share URLs hold a small **diff** (edited files + rule changes) over the base project — not whole
copies. Opening a permalink hydrates the SPA from base + diff, then the user can Run.

### Components
| Component | Tech | Responsibility |
|---|---|---|
| Playground SPA | React + TypeScript, Monaco | Editor (Code/Rules, tab/split), Findings & Rules trees, inline taint-path decorations, permalink, compare-to-grep |
| Pre-analyzed store | Static JSON on CDN | Instant first-paint results for the seed project |
| Scan API | Stateless service | Validate, rate-limit, classify, dispatch live scans |
| Worker pool | `ghcr.io/seqra/opentaint:latest` containers | Compile (on code edits) + scan; return SARIF |
| Permalink store | Edge KV | Store/retrieve shared edit diffs |

The engine is **unmodified opentaint** throughout — credibility is a feature.

## 8. Data model (key shapes)

- **Scenario:** `{ id, title, blurb, projectId, startFile, defaultFindingId }`.
- **Project snapshot:** file tree + file contents + ruleset tree (builtin/custom × rules/passthrough/
  dataflow).
- **Finding (from SARIF):** `{ id, ruleId, vulnClass, endpoint, severity, steps[] }` where each
  **step** = `{ index, kind: source|propagation|sanitizer|sink, file, line, label, crossesFile }`.
- **Permalink:** `{ baseProjectId, fileDiffs[], ruleDiffs[] }`.

## 9. UX details

- **Progress UI for code edits is deliberately explanatory** ("resolving deps → compiling →
  tracking dataflow across N methods → done"). The wait is reframed as proof of depth versus a grep.
- **Compare-to-grep toggle** (v1): a side-by-side that shows a naive single-file / pattern view
  *missing* the cross-file taint path opentaint catches — dramatizing the core message.
- **CTAs** are persistent and contextual ("Run this on your repo → install the CLI / add the
  Action"), shown most strongly right after a finding renders.
- **Empty/zero-finding state** (e.g., after a user adds a sanitizer) is a *win* state: "No taint
  reaches the sink — your sanitizer holds," reinforcing that the engine reasons, not pattern-matches.

## 10. Error handling

- **Compile failure** after a code edit: surface compiler diagnostics inline in the Code editor
  (file/line), keep the previous results visible but marked stale, never a blank screen.
- **Scan timeout / worker OOM or crash:** clear message + "try again" + fall back to the last good
  result; log full context server-side.
- **Rate limit exceeded:** friendly cooldown message with the CTA ("or run it locally with the CLI").
- **Invalid edit** (new file, new dependency, build-script change): reject at the API with a specific
  reason; the UI explains the v1 constraint.
- **Pre-analyzed/CDN load failure:** retry + minimal offline explanation; the live path is independent.

## 11. Security & abuse containment

Running user-edited code through `compile`/`scan` is arbitrary code execution and must be sandboxed:
- Ephemeral, **network-egress-denied** containers (deps are pre-baked, so no network is needed at run
  time); strict CPU/RAM/wall-clock limits; no persistence between jobs.
- Edits confined to **existing file paths**; reject new files, dependency changes, and build-script
  edits in v1.
- Per-IP rate limiting and a bounded global concurrency queue.
- No secrets in the image; results contain only analysis output.

## 12. Testing strategy

- **Unit (frontend):** SARIF → view-model mapping, taint-path step ordering and cross-file markers,
  diff apply/serialize, tree rendering, tab/split state.
- **Integration (backend):** Scan API validation rules; *code-edit* path triggers recompile and
  returns updated SARIF; *rule-only* path reuses the model and is materially faster; sandbox limits
  enforced.
- **Golden test:** the pre-analyzed store for `java-spring-demo` matches a fresh engine run (guards
  against drift when the engine or demo updates).
- **E2E (critical flow):** land → see a finding on first paint → open the rule → delete a sink →
  Run → finding disappears → restore → Run → finding returns → create share link → reopen link →
  state restored.
- Target ≥ 80% coverage on the SPA logic and the Scan API.

## 13. Phasing

**v1 (this spec):** SPA + instant read path + live re-run (code & rule edits, confined to
`java-spring-demo`) + Findings/Rules trees + inline taint path + tab/split + **shareable permalinks**
+ **compare-to-grep**. Seed content from `java-spring-demo`. No accounts.

**v2 candidates (explicitly out of v1):** "Check my own code" paste mode (arbitrary single files into
a template harness), embeddable `<iframe>` widget, accounts/saved workspaces, more seed projects /
languages as opentaint's roadmap (Python, Go, JS/TS, C#) lands.

## 14. Open questions / risks

- **Live-scan latency p95** on a code edit (recompile + analyze) is the biggest UX risk; needs early
  measurement against the real image to validate the warm-pool approach and tune worker sizing.
- **Worker cost at peak** (e.g., a launch spike / HN front page) — confirm autoscale-to-zero +
  concurrency cap keep cost bounded; consider a queue-with-position UI under load.
- **Engine/demo drift** — the golden test mitigates, but we need a refresh process when
  `opentaint` or `java-spring-demo` updates.
- **Rules format fidelity** — confirm the exact taint-mode YAML schema (sources/propagators/
  sanitizers/sinks, `mode: join`) against the live repo before building the Rules editor + validation.
