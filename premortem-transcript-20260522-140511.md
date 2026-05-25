# Premortem Transcript — OpenTaint Playground · Plan 2 (live re-run backend)

_Generated 2026-05-22 14:05. Method: prospective hindsight (Gary Klein). 9 parallel failure investigations._

## Context gathered

- **What:** Plan 2 of the OpenTaint Playground — the *live re-run backend*. Plan 1 (shipped) is the static read path (instant pre-analyzed results for the curated `seqra/java-spring-demo`). Plan 2 lets users edit code/rules in-browser and click **Run scan** for a fresh opentaint result.
- **Architecture (premortemed):** stateless Scan API + a warm pool of ephemeral `ghcr.io/seqra/opentaint:latest` containers (deps pre-pulled, JVM/Gradle daemon hot, base project model compiled); editing confined to `java-spring-demo`'s existing files (no new deps / no build-script changes). Code edit → recompile→scan (seconds–minutes, up to ~16GB RAM); rule-only edit → reuse model. Sandbox: egress-denied, CPU/RAM/wall-clock limits, edits confined to existing paths, per-IP rate limits, bounded concurrency queue, autoscale-to-zero.
- **Who for:** developers + AppSec engineers (adoption funnel for CLI installs) + the small open-source Seqra team who must operate it.
- **Success:** a visitor edits, clicks Run, sees a correct real re-scan within an acceptable wait — reliably, at bounded cost, with no security/abuse incident — lifting installs/stars/CI adoption.

## Frame

It is 6 months from now. The Plan-2 live backend launched and **failed**. Working backward to explain why.

## Raw premortem — failure reasons

1. Sandbox/RCE: compiling attacker-controlled Java is the core risk; "existing files only" is false safety; container escape is catastrophic.
2. Unbounded organic cost: recompile-per-edit × autoscale = ruinous bill for a small team.
3. Latency/p95: recompile+analyze stays in minutes under concurrency; edit→run conversion collapses.
4. Launch-spike starvation: autoscale-to-zero cold start + queue backup at peak attention; one-shot window wasted.
5. "Warm pool" is a fiction: scale-to-zero vs hot daemon/in-memory model is contradictory; warmth never materializes.
6. Result drift: live `:latest` ≠ the pre-analyzed read path; breaks the "deterministic" claim.
7. Edit→SARIF line-mapping bugs: taint path highlights the wrong lines after edits.
8. Malicious abuse: free compute → financial DoS + analysis-bomb inputs; per-IP limits bypassed by rotation.
9. No operational owner: a multi-tenant JVM compute service rots on a small engine-focused team.

---

## Deep dives

### #1 — Sandbox / RCE & container escape (Likelihood Med · Damage Critical)
**Story:** Three weeks post-launch a researcher posts a PoC: edit an existing `.java` file with a static-initializer payload that runs during Gradle's incremental compile. Egress-deny blocks TCP, but DNS exfil (UDP/53 carved out to the internal resolver, forwarded upstream) leaks the worker image's registry token as base64 subdomains. A second actor runs a cryptominer (~18 core-hours/day across the rate-limit window). Week five: a worker on a node with unpatched runc (CVE-2024-21626) escapes to the host, which runs other tenants — a security company's infra used as a pivot, public before the team notices.
**Assumption:** Confining *which files* can be edited equals confining *what code executes at build time* — ignoring that the Java/Gradle toolchain is a Turing-complete execution environment driven by file content.
**Warning signs:** High-entropy DNS lookups in worker build logs; "compile-only" jobs with CPU outlasting `javac` exit.

### #2 — Unbounded organic cost (Likelihood High · Damage High)
**Story:** 800 visitors week one, half click Run (90–180s CPU, 6–10GB RAM each). A newsletter mention → 25 concurrent jobs; autoscaler obeys; one 24h window burns $600 vs a $300/month budget. Emergency cap to 2 concurrency → queue 80, 22-min median wait, users leave. By month four the live path is a never-resolving spinner and is removed from the landing page; install conversion ≈ 0.
**Assumption:** "Autoscale-to-zero controls cost" — but ordinary success means jobs always run, and each is expensive enough that moderate organic traffic exceeds the budget.
**Warning signs:** Cost-per-run > $0.15 in load tests; week-one cost-per-unique-visitor > $0.50.

### #3 — Latency / p95 kills conversion (Likelihood High · Damage High)
**Story:** Solo testing fine (rule 8s, code 45s) → ships. Real traffic fills the one-per-slot queue; 45s compile → 3-min wall-clock wait; p95 > 4 min. Progress theatre burns goodwill in 90s then reads as a broken spinner. Edit→run conversion ~40% solo → 12% → 8%; returning users avoid the live path. Funnel goal unreachable.
**Assumption:** Warm containers cut latency enough that queue wait + compile stays within patience — they remove only one of three compounding delays.
**Warning signs:** p95 > 60s at 3 concurrent scans; edit→run conversion < 25% week one, abandons at 60–90s.

### #4 — Launch-spike queue starvation (Likelihood High · Damage High, one-shot)
**Story:** HN front page at 9:47am onto an idle (scaled-to-zero) system. First 50 Runs in 90s while cold starts take 90–120s each; queue 200+, per-IP 429s on retriers, thread fills with "just spun for me." 4,000 visitors, 94% bounce on scan page, 11 installs. The one-shot window is gone; latecomers get a perfect experience nobody sees.
**Assumption:** Autoscale-to-zero and launch timing are independent — no explicit pre-warm needed before a scheduled launch.
**Warning signs:** Median time-to-first-result > 90s from cold; queue depth > 20 within 60s of a burst with nothing warm.

### #5 — The "warm pool" is a fiction (Likelihood Very High · Damage High)
**Story:** Scale-to-zero destroys the JVM process + in-memory compiled model on each idle event; ephemeral per-job containers never serve a second build while warm, so the Gradle daemon is born and dies in one 90s window. "Rule-only reuses the compiled model" is equally fictional — the model lived in the prior container's heap; the next job gets a fresh container. Every job recompiles from scratch. To hit acceptable p50 they keep one always-on instance, erasing scale-to-zero savings.
**Assumption:** "Warm" JVM/daemon/model state persists across jobs — conflating pool-level readiness (images pre-pulled) with process-level warmth (live heap, active daemon) destroyed at teardown.
**Warning signs:** p95 > 3× p50 once >10 min between runs; Gradle daemon reuse rate across container boundaries = 0.

### #6 — Read-path vs live-path result drift (Likelihood High · Damage High, credibility)
**Story:** Engineer loads instant view (14 findings), clicks Run with no edits → 11 findings, one line shifted. Static SARIF built at opentaint `a3f8c1` / demo `v1.0`; `:latest` is now `b9d44e` (changed rule thresholds, a path-resolution fix) and a README commit shifted a line. No version pin/badge/diff. Tweet: "claims deterministic, different findings twice — hard pass." Contradicts the headline claim with the target audience.
**Assumption:** `opentaint:latest` at request time = the build-time snapshot — treating "deterministic" as a property of the algorithm, not of (algorithm + version + inputs).
**Warning signs:** Deployed `:latest` digest ≠ digest used for static SARIF; post-deploy unedited live run returns finding count ≠ baseline.

### #7 — Edit → SARIF line-mapping bugs (Likelihood Med-High · Damage High, centerpiece)
**Story:** User adds a 5-line docblock; sink moves to line 47 but SARIF says 42 → decoration paints a comment line; the step tree confirms the lie. The pipeline normalizes/reformats source before analysis, so SARIF maps to the normalized artifact, not the editor buffer; Monaco 0-indexed vs SARIF 1-indexed adds a silent off-by-one. Corrosive case: 80% land right, 20% (a reformatted transitive file) wrong; the engineer trusts the 80% and misses a real sink.
**Assumption:** SARIF line numbers map 1:1 to the raw Monaco buffer, with no transformation/normalization/indexing difference.
**Warning signs:** Decorations a constant N lines off on a fresh no-edit scan; accuracy degrades with lines-added (positional, not anchor-based).

### #8 — Malicious abuse / denial-of-wallet (Likelihood Med-High · Damage High)
**Story:** Botnet on rotating residential proxies hammers `/scan` with crafted deep call-graphs forcing exponential dataflow blowup — every job hits the 5-min timeout, saturating the pool; legit users see queue-full 100%. 10 req/min per-IP × 500 nodes = 2,500 pathological jobs/min. Spend $300→$4,000 in one cycle. Killed after the second invoice; no affordable mitigation (PoW hurts mobile, CAPTCHA adds a dep, tighter timeouts make attacks cheaper).
**Assumption:** Per-IP rate limiting resists abuse when cost-per-request is high enough to attract botnet-equipped adversaries.
**Warning signs:** p95 job duration > 90% of wall-clock timeout within 48h; active containers pinned at ceiling while unique sessions stay flat.

### #9 — No operational owner (Likelihood High · Damage High, slow rot)
**Story:** Launch excitement fades; engine sprint begins. New `:latest` changes a JVM flag → startup probe breaks → containers never healthy → autoscaler spins up more, costs double, dead 11 days (monitor only checks the gateway). A dependency CVE sits unassigned 3 weeks until a researcher tweets it; rushed patch ships an OOM-kill regression for scans >50 lines for another month. Month six: ~30% of requests error; the team debates shutdown — signaling Seqra can't operate production software.
**Assumption:** Infra needing continuous operational attention will get it from a team whose mandate/attention is the engine/CLI.
**Warning signs:** Time-to-patch a disclosed worker-image CVE > 7 days; gateway 200 but p95 scan latency > 8s for 48h+ with no incident ticket.

---

## Synthesis

**Most likely failure:** The "warm pool" is a fiction (#5) → uniformly slow and expensive, which is the engine behind the latency (#3) and cost (#2) failures. It's the default behavior of the architecture, not an edge case.

**Most dangerous failure:** Compiling attacker-controlled Java → container escape (#1). Lower probability, existential damage for a security company.

**Hidden assumption:** That interactivity requires running the full, unmodified heavyweight engine live, per request, on arbitrary edits. opentaint is a minutes-long, multi-GB, whole-program JVM batch tool that compiles arbitrary code — cost, latency, abuse, ops, and security failures all grow from this one root.

**Revised plan:**
1. Don't run arbitrary code live — lead with rule-editing on a persisted compiled base-model artifact (no Gradle/attacker code/daemon dependency at request time).
2. For code edits: precompute curated "what-if" variants, or gate live compile behind a session challenge + a hard global daily spend cap with graceful fallback.
3. Pin opentaint by digest; regenerate the static SARIF from the same digest; CI asserts no-edit live run == static baseline.
4. Anchor-based line mapping; run the engine on exact editor bytes; one tested 0/1-based converter.
5. Treat the worker as hostile: microVM isolation, patched host pool, deny all egress incl. DNS, no secrets in image, one tenant per microVM.
6. Bound cost/abuse hard: global concurrency + spend ceiling that disables the live path; per-session challenge tokens; analysis time/mem caps; queue-position UI + fallback.
7. Name an operational owner before building — or ship static-only + "run it locally" CTA.

**Pre-launch checklist:**
- Load test: p95 < 60s at 3 concurrent AND cost-per-run < $0.15 — else don't launch live.
- Security: microVM, egress fully denied incl. DNS, no tokens in image, host pool patched; red-team file-edit RCE attempt fails.
- Version parity gate: opentaint pinned by digest; no-edit live run == static baseline; static SARIF from that digest.
- Hard daily spend cap → auto-disable + graceful fallback; per-session challenge; analysis timeout/mem tuned for pathological inputs.
- Named ops owner + full-path synthetic monitor + image CVE auto-rebuild; pre-warm before launch (never from zero).
