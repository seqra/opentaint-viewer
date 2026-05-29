# Mobile View — Design

**Status:** Approved (brainstorm). Pending implementation plan.
**Scope:** Phone-first adaptation (`≤ 640px`) of the OpenTaint Viewer UI.

## Goal

Make the viewer usable on a phone with **full feature access** but **no split views**. Every desktop pane (FindingsTree, RulesTree, Code, Rules-as-rule-view, finding Info, Steps) is reachable; nothing is hidden or read-only-by-omission. Layout is heavily adapted: panels stack into a single column, navigation is tab-based, the sidebar becomes an overlay drawer.

The desktop layout (`≥ 641px`) is unchanged.

## Non-goals

- Tablet / mid-size adaptation (641–1023px keeps the desktop layout).
- Touch-drag step scrubbing or swipe-between-tabs gestures (taps only).
- Reordering / hiding findings on phone — the tree is the desktop tree, just rendered in an overlay.
- Replacing Monaco with a lighter renderer.
- Landscape-specific layout — a 640×360 landscape phone gets the phone shell too.
- Backend / live re-analysis (already deferred — see memory `live-backend-deferred`).

## Breakpoint

One breakpoint everywhere: `(max-width: 640px)`.

Layout selection is **JS-driven** — `AppShell` subscribes to `window.matchMedia('(max-width: 640px)')` via `useSyncExternalStore` and renders **either** `<DesktopShell />` **or** `<MobileShell />`, never both. See *Rendering strategy* for the trade-off rationale (this section was revised after the initial dual-mount design caused duplicate Monaco mounts and Playwright strict-mode collisions in the e2e tests).

Monaco config is the only other JS-side viewport read: editor options aren't stylable via CSS, so the phone overrides are picked at editor mount via a one-shot `window.matchMedia('(max-width: 640px)').matches` check. This is a mount-time read, not a subscription — rotating the device after the editor mounts does not re-apply.

## Layout structure

```
┌───────────────────────────────────┐
│ TopBar:  ☰  [logo]    ★  Install  │   ~44px
├───────────────────────────────────┤
│ Top tabs:  [Code]  Details  Rule  │   ~36px
├───────────────────────────────────┤
│ Context strip: XSS — File.java:42 │   ~28px  (current finding)
├───────────────────────────────────┤
│                                   │
│  Active pane content              │
│  (Monaco / Info / Steps / Rule)   │
│                                   │
├───────────────────────────────────┤
│ Step footer:  ←  Step 2/6  →      │   ~40px (only when a finding selected)
└───────────────────────────────────┘
```

Stripped versus desktop:
- `ActivityBar` (replaced by drawer + ☰).
- `react-resizable-panels` horizontal and vertical `PanelGroup`s and handles.
- `SplitTabsView`'s Split/Tabs layout-toggle button (no split on phone).

## TopBar (phone variant)

Four items, in order:

1. **☰** — opens the drawer.
2. **Logo** — `<img>` linking to https://opentaint.org/ (unchanged target).
3. **★ Star** — link to the OpenTaint GitHub repo (unchanged target).
4. **Install** — primary CTA, links to the quick-start (unchanged target).

Theme toggle, analyzer version chip, and any future chrome live in the **drawer footer**, not the TopBar. The TopBar carries only brand + CTA.

## Drawer

- Slides in from the left as an overlay (~80vw, full height).
- Scrim behind, `aria-hidden` toggled.
- Closes on: scrim tap, ✕ tap, Escape, or selecting a tree node.
- **Content**:
  - Header: `Browse` + ✕
  - Segmented control: `⚠ Findings` ⟷ `⚖ Rules` (flips `sidebarView` without closing the drawer)
  - Body: existing `FindingsTree` or `RulesTree`, unchanged
  - Footer: theme toggle + analyzer version chip (the desktop TopBar items that don't fit the phone TopBar)
- Selecting a finding or rule sets the selection in the store and auto-closes the drawer.

## Top tabs: Code · Details · Rule

- **Code** — `<CodeView />`, the Monaco editor with taint decorations and the file-tabs strip.
- **Details** — a thin wrapper that renders `Info` / `Steps` as nested sub-tabs:
  - `Info` → `<FindingInfo />`
  - `Steps` → `<StepsList />`
  - Sub-tab state reuses the existing `infoTab` field — no new state, no duplication.
- **Rule** — `<RulesView />`, the rule-detail view that lives behind the desktop Editor's `Rules` tab. On phone it gets promoted to a top-level tab.

The top-tab state is **one new field**, `mobileTab: 'code' | 'details' | 'rule'`, added to the persisted `ot-view` slice. Default: `'code'`.

The desktop `viewMode` (split vs tabs) is irrelevant on phone and is not read.

## Step navigation footer

- Visible whenever `findings.length > 0` (so almost always — the default selects `findings[0]`).
- Layout: `[← Prev]   Step N/M · jump-to-file.java   [Next →]`. Middle label shows current step index plus the file the *next* step lands in.
- Dispatches the same `nextStep` / `prevStep` actions used by `useStepKeys` — touch surface, not new logic.
- `useStepKeys` keeps working unchanged for hardware-keyboard users.
- Tap targets ≥ 44×44.
- **Cross-tab behaviour**:
  - Prev/Next from any tab stays on that tab — no surprise tab switches.
  - Tapping a step *row* inside the Steps sub-tab switches to the Code tab (same as the desktop "click a step → jump to code" affordance).
  - When a step crosses files, the file-tabs strip auto-scrolls the new file into view.

## CodeView on phone

Monaco stays. The taint decorations are core value; replacing the editor would mean re-implementing syntax + highlights for marginal weight savings.

Below the breakpoint, Monaco config overrides:

- `readOnly: true` (explicit, so iOS doesn't pop the keyboard on tap).
- `minimap.enabled: false`.
- `lineNumbersMinChars: 3`.
- `scrollBeyondLastLine: false`.
- `wordWrap: 'off'` — taint highlights are line-based; wrapping mangles spans. Users horizontally pan instead.
- `fontSize: 13`.

**File tabs strip**: horizontally scrollable (`overflow-x: auto; -webkit-overflow-scrolling: touch`), slightly tighter padding. Active file scrolls into view when step navigation jumps files.

**Decorations**: unchanged — same `taint-faint` / `taint-current` / `taint-sink` classes and the same scroll-to-step behaviour from `src/taint/`. Auto-scroll on step change is what makes long files tolerable on a phone.

**Touch gestures**: Monaco's native two-finger pan and pinch-zoom are sufficient; no custom gesture handlers.

## State model

One new field added to the persisted `ot-view` slice:

```ts
type MobileTab = 'code' | 'details' | 'rule';

interface ViewState {
  // ...existing fields
  mobileTab: MobileTab; // default 'code'
}
```

The persistence guard in `src/state/store.ts` is extended to accept (and default) `mobileTab`. The desktop session can ignore it; the phone session reads and writes it.

Drawer open/closed is **not** a new field — it is derived from `sidebarView`:
- `sidebarView === null` → drawer closed
- `sidebarView !== null` → drawer open (showing whichever tree)

This piggybacks on the existing `toggleSidebar` / `setSidebarView` API.

Selection state (finding, step, files, theme) is shared between desktop and phone — only layout-shape state (`viewMode`, `infoViewMode`, `mobileTab`) is platform-specific.

## Rendering strategy

`AppShell.tsx` subscribes to `window.matchMedia('(max-width: 640px)')` via `useSyncExternalStore` and renders **one** shell — never both:

```
src/components/
  AppShell.tsx           ← matchMedia → <DesktopShell /> OR <MobileShell />
  DesktopShell.tsx       ← today's AppShell innards (TopBar + ActivityBar + PanelGroup)
  MobileShell.tsx        ← new: phone TopBar + top tabs + content + step footer + drawer
  MobileDrawer.tsx       ← new: overlay drawer with segmented Findings/Rules
  MobileStepFooter.tsx   ← new: thumb-sized step nav
```

```tsx
// AppShell.tsx (sketch)
const isPhone = useSyncExternalStore(subscribeViewport, readIsPhone, () => false);
return isPhone ? <MobileShell /> : <DesktopShell />;
```

### Why JS-driven, not the dual-mount + CSS toggle this section originally proposed

The first design called for both shells in the DOM with `@media (max-width: 640px)` hiding whichever didn't match. We pivoted during implementation (commit `d086bfd`) for two concrete reasons:

1. **Duplicate Monaco mounts.** Even with `display: none`, React mounts hidden children, so `<CodeView />` inside the mobile-default `mobileTab === 'code'` instantiated a second Monaco editor on every desktop page load. The spec's earlier "lazy mount only when Code is active" claim was wrong — the tab is active by default.
2. **Playwright strict-mode collisions.** All 10 existing desktop e2e tests broke because `getByTestId('top-bar')` (and similar) matched two elements (one per shell), and Playwright's strict-mode locator API doesn't tolerate that.

The trade-off the original design was protecting against (Monaco re-mount on viewport flip) is vanishingly rare in practice: rotating a 640px-wide device, or dragging a desktop browser window across the breakpoint. The cost of losing Monaco's in-editor state on that flip is acceptable; selection (file, finding, step) survives via the Zustand store.

**Subscription cleanup**: `MobileShell` subscribes to the store to auto-close its drawer on selection changes. With JS-side rendering, MobileShell unmounts on a desktop flip, React runs the effect cleanup, and the subscription is removed — no leak.

**TopBar is one component**, not two. It internally renders chrome that's hidden via `@media` (the ☰ button is `display: none` on desktop; theme toggle and version chip are `display: none` on phone). Shared logic (brand link, theme state, version chip) stays in one place.

## Files added / changed

| File | Status | Change |
| --- | --- | --- |
| `src/components/AppShell.tsx` | changed | `useSyncExternalStore(matchMedia)` selects `<DesktopShell />` OR `<MobileShell />`; only one is mounted. |
| `src/components/AppShell.module.css` | unchanged | No mobile-view changes (the dual-mount `@media` toggle from the original design was rolled back). |
| `src/test-setup.ts` | changed | jsdom matchMedia + localStorage shims so the new viewport and persistence tests can run. |
| `src/components/DesktopShell.tsx` | new | Extracted from current `AppShell.tsx`. No behaviour change. |
| `src/components/MobileShell.tsx` | new | Phone layout: top tabs, context strip, content router, step footer, drawer mount. |
| `src/components/MobileDrawer.tsx` | new | Overlay drawer + segmented Findings/Rules tab strip. |
| `src/components/MobileStepFooter.tsx` | new | Thumb-sized prev/next/label footer. |
| `src/components/TopBar.tsx` + `.module.css` | changed | Add a phone variant: ☰ + logo + Star + Install only. Hide version chip + theme toggle below breakpoint (moved into drawer footer). |
| `src/components/CodeView.tsx` | changed | At editor mount, read `window.matchMedia('(max-width: 640px)').matches` and merge in phone Monaco overrides. |
| `src/state/store.ts` | changed | Add `mobileTab` to state, persistence guard, and setter. |
| `src/components/MobileShell.test.tsx` | new | Component tests. |
| `e2e/mobile.spec.ts` | new | Playwright spec at iPhone-14 viewport. |

## Testing

**Unit / component (Vitest + Testing Library + jsdom):**

- `MobileShell` renders the drawer closed by default, opens on `☰`, closes on scrim tap and on tree selection.
- `mobileTab` round-trips through `localStorage` (`ot-view` guard accepts it, defaults it on missing/invalid).
- Step footer prev/next dispatches `nextStep` / `prevStep` and disables at boundaries.
- Top tabs respect `mobileTab`; Details sub-tabs respect `infoTab`.
- `TopBar` renders the desktop chrome above 641px and the phone chrome below (via viewport mocking).

**E2E (Playwright):** one new spec at a phone viewport (`{ width: 390, height: 844 }` — iPhone 14) walking the golden path:

1. Load the bundled demo.
2. Tap `☰`, drawer opens.
3. Tap a finding in the Findings tree, drawer closes, finding is selected.
4. Top tabs show; `Code` is active by default; Monaco shows the source with decorations.
5. Tap `Details`, then `Steps`, then a step row → Code tab activates and Monaco scrolls to the step.
6. Tap the step footer `Next` from any tab → step advances, tab stays.

Existing desktop e2e stays unchanged.

**Manual:** spot-check iOS Safari (Monaco + drawer scrim) and Chrome Android — `100vh` and overscroll behaviour vary across mobile browsers.

## Open questions deferred to the plan

- Container queries vs `@media` for the TopBar inner variants. `@media` works fine in this app (the TopBar is always full viewport width); container queries are only needed if a future embed scenario shrinks the bar independently of the viewport.
- Drawer animation duration / easing — picked during implementation, not a design decision.
