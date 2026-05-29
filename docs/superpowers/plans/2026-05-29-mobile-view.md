# Mobile View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the OpenTaint Viewer to phones (`≤ 640px`) with full feature access but no split views — drawer + top tabs (Code / Details / Rule), step footer, lean TopBar. Desktop layout (`≥ 641px`) is unchanged.

**Architecture:** `AppShell` mounts *both* `DesktopShell` and `MobileShell`; a single CSS media query toggles which one is visible. Both shells consume the same Zustand store, so all selection state (finding, step, file, theme) is shared. Drawer open/closed is derived from the existing `sidebarView` field. The mobile top tab is one new persisted field, `mobileTab`. Monaco config is the only JS-side viewport check: a one-shot `matchMedia` at editor mount.

**Tech Stack:** React 18, TypeScript, Vite, Zustand (with persist middleware), Monaco Editor, Lucide icons, CSS Modules, Vitest + Testing Library + jsdom, Playwright.

---

## File structure

| Path | Status | Responsibility |
| --- | --- | --- |
| `src/state/store.ts` | changed | Add `MobileTab` type, `mobileTab` state, `setMobileTab` action, persistence guard. |
| `src/components/AppShell.tsx` | changed | Thin wrapper: renders `<DesktopShell />` and `<MobileShell />` side by side under CSS-toggled wrappers. |
| `src/components/AppShell.module.css` | changed | `.desktop` / `.mobile` wrappers + `@media (max-width: 640px)` toggle. |
| `src/components/DesktopShell.tsx` | new | Today's `AppShell` innards (TopBar + ActivityBar + PanelGroup). Extracted with no behaviour change. |
| `src/components/MobileShell.tsx` | new | Phone layout: TopBar + top tabs + context strip + content router + step footer + drawer mount. |
| `src/components/MobileShell.module.css` | new | Mobile shell layout. |
| `src/components/MobileDrawer.tsx` | new | Overlay drawer with segmented Findings/Rules control + tree + theme/version footer. |
| `src/components/MobileDrawer.module.css` | new | Drawer styling, scrim, slide-in animation. |
| `src/components/MobileStepFooter.tsx` | new | Thumb-sized prev/next + step counter + next-file hint. |
| `src/components/MobileStepFooter.module.css` | new | Step footer styling, ≥44×44 tap targets. |
| `src/components/TopBar.tsx` | changed | Split chrome into `.desktopOnly` and `.mobileOnly` child groups; add ☰ button on mobile. |
| `src/components/TopBar.module.css` | changed | Hide/show chrome groups under `@media (max-width: 640px)`. |
| `src/components/CodeView.tsx` | changed | At editor mount, read `window.matchMedia('(max-width: 640px)').matches` and merge in phone Monaco overrides. |
| `src/components/MobileShell.test.tsx` | new | Component tests for tabs, drawer, step footer, context strip. |
| `src/components/MobileDrawer.test.tsx` | new | Drawer open/close + Findings/Rules segmented control. |
| `src/components/MobileStepFooter.test.tsx` | new | Prev/next dispatch + boundary disable + hidden when no findings. |
| `src/state/store.test.ts` | modified (or new) | `mobileTab` persistence guard test. |
| `e2e/mobile.spec.ts` | new | Playwright golden path at iPhone-14 viewport. |
| `playwright.config.ts` | changed | Add a `mobile` project (iPhone 14) alongside the default Desktop Chrome. |

---

## Task 1: Store — add `mobileTab` field, action, and persistence guard

**Files:**
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/state/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';

describe('store — mobileTab persistence guard', () => {
  beforeEach(() => useStore.getState().reset());

  it('defaults mobileTab to "code"', () => {
    expect(useStore.getState().mobileTab).toBe('code');
  });

  it('setMobileTab updates the field', () => {
    useStore.getState().setMobileTab('details');
    expect(useStore.getState().mobileTab).toBe('details');
    useStore.getState().setMobileTab('rule');
    expect(useStore.getState().mobileTab).toBe('rule');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL — `setMobileTab` is not a function / `mobileTab` is undefined.

- [ ] **Step 3: Add the type, state, and action to the store**

In `src/state/store.ts`:

1. Add the type next to the other tab types (~line 12):

```ts
/** Phone top tab. */
export type MobileTab = 'code' | 'details' | 'rule';
```

2. Add to the `State` interface (~line 33, after `infoViewMode`):

```ts
  /** Phone top tab (Code / Details / Rule). Desktop ignores this. */
  mobileTab: MobileTab;
```

3. Add to the `Actions` interface (~line 50, after `setInfoViewMode`):

```ts
  setMobileTab: (t: MobileTab) => void;
```

4. Add to the `initial` constant (~line 54, append):

```ts
const initial: State = {
  content: null, activeFindingId: null, activeStepIndex: null, activeFlowIndex: 0,
  activeFile: null, activeRuleId: null, activeRuleAnchor: null, ruleFocusTick: 0, viewMode: 'tabs', activeTab: 'code',
  sidebarView: 'findings', infoTab: 'info', infoViewMode: 'tabs',
  mobileTab: 'code',
};
```

5. Add to `PersistedView` (~line 61):

```ts
type PersistedView = Pick<
  State,
  'activeFindingId' | 'activeStepIndex' | 'activeFlowIndex' | 'activeFile' | 'activeRuleId'
  | 'activeTab' | 'sidebarView' | 'infoTab' | 'viewMode' | 'infoViewMode' | 'mobileTab'
>;
```

6. Add the action implementation in the `create` block (~line 185, after `setInfoViewMode`):

```ts
  setMobileTab: (mobileTab) => set({ mobileTab }),
```

7. Add to `partialize` (~line 202):

```ts
    infoViewMode: s.infoViewMode,
    mobileTab: s.mobileTab,
```

8. Add to the `merge` guard (~line 215, before the closing brace):

```ts
      infoViewMode: oneOf(p.infoViewMode, ['tabs', 'split'] as const, 'tabs'),
      mobileTab: oneOf(p.mobileTab, ['code', 'details', 'rule'] as const, 'code'),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Add the persistence guard test**

Append to `src/state/store.test.ts`:

```ts
import { create } from 'zustand';
// Re-test the rehydrate guard by replaying a corrupt persisted blob.

it('merge guard defaults invalid mobileTab back to "code"', async () => {
  // Direct invocation of the merge function via the store's persist API.
  // We simulate a corrupted persisted blob and confirm the runtime value is safe.
  globalThis.localStorage.setItem(
    'ot-view',
    JSON.stringify({ state: { mobileTab: 'garbage' }, version: 1 }),
  );
  // Recreate by reading; zustand-persist applies merge on hydrate.
  // (Reset reseeds initial; we want to reload from storage.)
  await useStore.persist.rehydrate();
  expect(useStore.getState().mobileTab).toBe('code');
});
```

- [ ] **Step 6: Run the new guard test**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS — 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat: add mobileTab state, action, and persistence guard"
```

---

## Task 2: Refactor — extract `DesktopShell` from `AppShell` (no behaviour change)

This task is a pure refactor: move today's `AppShell` body into a new `DesktopShell` component. `AppShell` becomes a thin wrapper that just renders it. Existing tests must continue to pass.

**Files:**
- Create: `src/components/DesktopShell.tsx`
- Modify: `src/components/AppShell.tsx`
- Existing test: `src/App.test.tsx` (must still pass without changes)

- [ ] **Step 1: Create `DesktopShell.tsx` with the current `AppShell` body**

Write `src/components/DesktopShell.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import { TopBar } from './TopBar';
import { FindingsTree } from './FindingsTree';
import { RulesTree } from './RulesTree';
import { EditorArea } from './EditorArea';
import { InfoPanel } from './InfoPanel';
import { ActivityBar } from './ActivityBar';
import { useStore, type SidebarView } from '../state/store';
import styles from './AppShell.module.css';

export function DesktopShell() {
  const view = useStore((s) => s.sidebarView);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const setSidebarView = useStore((s) => s.setSidebarView);
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const lastViewRef = useRef<SidebarView>('findings');

  useEffect(() => {
    if (view) lastViewRef.current = view;
  }, [view]);

  useEffect(() => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (view === null) panel.collapse();
    else if (panel.isCollapsed()) panel.expand();
  }, [view]);

  return (
    <div className={styles.shell}>
      <TopBar />
      <div className={styles.body}>
        <ActivityBar active={view} onSelect={toggleSidebar} />
        <PanelGroup direction="horizontal" autoSaveId="ot-body" className={styles.panels}>
          <Panel
            ref={sidebarRef}
            collapsible
            collapsedSize={0}
            defaultSize={22}
            minSize={12}
            maxSize={45}
            className={styles.sidebar}
            onCollapse={() => setSidebarView(null)}
            onExpand={() => {
              if (!useStore.getState().sidebarView) setSidebarView(lastViewRef.current);
            }}
          >
            {view && (
              <div className={styles.sidePanel}>
                <div className={styles.shead}>{view === 'findings' ? 'FINDINGS' : 'RULES'}</div>
                <div className={styles.scroll}>{view === 'findings' ? <FindingsTree /> : <RulesTree />}</div>
              </div>
            )}
          </Panel>
          <PanelResizeHandle className={styles.bodyHandle} style={{ display: view ? undefined : 'none' }} />
          <Panel defaultSize={78} minSize={30} className={styles.main}>
            <PanelGroup direction="vertical" autoSaveId="ot-main">
              <Panel defaultSize={68} minSize={20} className={styles.mainPane}>
                <EditorArea />
              </Panel>
              <PanelResizeHandle className={styles.vHandle} />
              <Panel defaultSize={32} minSize={10} className={styles.mainPane}>
                <InfoPanel />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `AppShell.tsx` body with a wrapper**

Overwrite `src/components/AppShell.tsx`:

```tsx
import { useEffect } from 'react';
import { DesktopShell } from './DesktopShell';
import { useStepKeys } from './useStepKeys';
import { useTheme } from '../state/theme';

export function AppShell() {
  const theme = useTheme((s) => s.theme);
  useStepKeys();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return <DesktopShell />;
}
```

(MobileShell will be added in Task 7; this intermediate state keeps the existing app working.)

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS — both tests in `App.test.tsx` still pass unchanged.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppShell.tsx src/components/DesktopShell.tsx
git commit -m "refactor: extract DesktopShell from AppShell (no behaviour change)"
```

---

## Task 3: MobileDrawer component

The drawer is an overlay that shows the Findings or Rules tree, with a segmented control to switch between them. Tapping a tree node sets the selection in the store and closes the drawer. The drawer's open/closed state is derived from `sidebarView`.

**Files:**
- Create: `src/components/MobileDrawer.tsx`
- Create: `src/components/MobileDrawer.module.css`
- Test: `src/components/MobileDrawer.test.tsx` (new)

- [ ] **Step 1: Write the failing tests**

Create `src/components/MobileDrawer.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import { MobileDrawer } from './MobileDrawer';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

beforeEach(() => {
  useStore.getState().reset();
  useStore.getState().loadContent(loadContent());
});

describe('MobileDrawer', () => {
  it('does not render when sidebarView is null', () => {
    useStore.setState({ sidebarView: null });
    const { container } = render(<MobileDrawer />);
    expect(container.querySelector('[data-testid="mobile-drawer"]')).toBeNull();
  });

  it('renders the Findings tree when sidebarView is "findings"', () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    expect(screen.getByTestId('mobile-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('findings-tree')).toBeInTheDocument();
    expect(screen.queryByTestId('rules-tree')).toBeNull();
  });

  it('switches to the Rules tree via the segmented control', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    await userEvent.click(screen.getByRole('tab', { name: /rules/i }));
    expect(useStore.getState().sidebarView).toBe('rules');
  });

  it('closes the drawer on scrim click', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    await userEvent.click(screen.getByTestId('mobile-drawer-scrim'));
    expect(useStore.getState().sidebarView).toBeNull();
  });

  it('closes the drawer on ✕ click', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    await userEvent.click(screen.getByLabelText(/close/i));
    expect(useStore.getState().sidebarView).toBeNull();
  });

  it('closes the drawer when Escape is pressed', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    await userEvent.keyboard('{Escape}');
    expect(useStore.getState().sidebarView).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/MobileDrawer.test.tsx`
Expected: FAIL — `MobileDrawer` does not exist.

- [ ] **Step 3: Create the CSS module**

Write `src/components/MobileDrawer.module.css`:

```css
.scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}
.drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: 80vw;
  max-width: 320px;
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  z-index: 101;
  display: flex;
  flex-direction: column;
  font-family: var(--mono);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--fg);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.close {
  background: transparent;
  border: none;
  color: var(--fg-dim);
  font-size: 18px;
  width: 32px;
  height: 32px;
  cursor: pointer;
}
.close:hover { color: var(--fg); }
.tabs { display: flex; border-bottom: 1px solid var(--border); }
.tab {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--fg-dim);
  font-size: 11px;
  padding: 10px 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-bottom: 2px solid transparent;
  font-family: var(--mono);
}
.tab.active { color: var(--fg); border-bottom-color: var(--accent); background: var(--bg-3); }
.body { flex: 1; min-height: 0; overflow-y: auto; }
.foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--fg-dim);
}
.themeBtn {
  background: var(--bg-3);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  font-family: var(--mono);
}
.themeBtn:hover { border-color: var(--accent); }
.version { margin-left: auto; font-size: 10px; }
```

- [ ] **Step 4: Create the component**

Write `src/components/MobileDrawer.tsx`:

```tsx
import { useEffect } from 'react';
import { ShieldAlert, Scale } from 'lucide-react';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';
import { FindingsTree } from './FindingsTree';
import { RulesTree } from './RulesTree';
import styles from './MobileDrawer.module.css';

export function MobileDrawer() {
  const view = useStore((s) => s.sidebarView);
  const setSidebarView = useStore((s) => s.setSidebarView);
  const tool = useStore((s) => s.content?.tool);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);

  // Close on Escape while the drawer is open. Per the spec, Escape is a close trigger
  // alongside scrim tap, ✕ tap, and tree-node selection.
  useEffect(() => {
    if (!view) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSidebarView(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, setSidebarView]);

  if (!view) return null;

  const semver = tool?.semanticVersion ? `v${tool.semanticVersion}` : null;
  const buildVer = tool?.version ? tool.version.replace(/^analyzer\//, '') : null;
  const versionLabel = [semver, buildVer].filter(Boolean).join(' · ');

  const close = () => setSidebarView(null);

  return (
    <>
      <div
        className={styles.scrim}
        data-testid="mobile-drawer-scrim"
        onClick={close}
        aria-hidden="true"
      />
      <div className={styles.drawer} data-testid="mobile-drawer" role="dialog" aria-label="Browse">
        <div className={styles.head}>
          <span>Browse</span>
          <button
            type="button"
            className={styles.close}
            onClick={close}
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Tree view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'findings'}
            className={`${styles.tab} ${view === 'findings' ? styles.active : ''}`}
            onClick={() => setSidebarView('findings')}
          >
            <ShieldAlert size={14} /> Findings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'rules'}
            className={`${styles.tab} ${view === 'rules' ? styles.active : ''}`}
            onClick={() => setSidebarView('rules')}
          >
            <Scale size={14} /> Rules
          </button>
        </div>
        <div className={styles.body}>
          {view === 'findings' ? <FindingsTree /> : <RulesTree />}
        </div>
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.themeBtn}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {versionLabel && <span className={styles.version}>{versionLabel}</span>}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/MobileDrawer.test.tsx`
Expected: PASS — 6 tests pass.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/MobileDrawer.tsx src/components/MobileDrawer.module.css src/components/MobileDrawer.test.tsx
git commit -m "feat: add MobileDrawer overlay with segmented Findings/Rules + theme/version foot"
```

> **Note on drawer auto-close on tree selection:** the spec calls for the drawer to close when the user picks a finding or rule. We can't change `FindingsTree` / `RulesTree` without breaking the desktop sidebar that uses them. Instead, MobileShell will subscribe to selection changes and close the drawer (Task 6, Step 5). Keeping that wiring in the shell — not in the drawer — preserves the tree components' double duty.

---

## Task 4: MobileStepFooter component

A thumb-sized prev/next bar pinned below the content area. Dispatches `step('back')` and `step('next')`. Hidden when no finding is selected.

**Files:**
- Create: `src/components/MobileStepFooter.tsx`
- Create: `src/components/MobileStepFooter.module.css`
- Test: `src/components/MobileStepFooter.test.tsx` (new)

- [ ] **Step 1: Write the failing tests**

Create `src/components/MobileStepFooter.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import { MobileStepFooter } from './MobileStepFooter';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

beforeEach(() => {
  useStore.getState().reset();
  useStore.getState().loadContent(loadContent());
});

describe('MobileStepFooter', () => {
  it('does not render when no finding is selected', () => {
    useStore.setState({ activeFindingId: null });
    const { container } = render(<MobileStepFooter />);
    expect(container.querySelector('[data-testid="mobile-step-footer"]')).toBeNull();
  });

  it('shows current step index, total, and Prev/Next buttons', () => {
    render(<MobileStepFooter />);
    const footer = screen.getByTestId('mobile-step-footer');
    expect(footer).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous step/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
    // counter format "N/M"
    expect(footer.textContent).toMatch(/\d+\s*\/\s*\d+/);
  });

  it('Next advances the active step', async () => {
    // Force selection onto step 0 so "Next" has somewhere to go.
    const state = useStore.getState();
    if (state.activeFindingId) state.selectStep(state.activeFindingId, 0);
    const before = useStore.getState().activeStepIndex;
    await userEvent.click(screen.getByRole('button', { name: /next step/i }));
    const after = useStore.getState().activeStepIndex;
    expect(after).toBe((before ?? 0) + 1);
  });

  it('disables Prev at step 0 and Next at the last step', async () => {
    const state = useStore.getState();
    if (state.activeFindingId) state.selectStep(state.activeFindingId, 0);
    render(<MobileStepFooter />);
    expect(screen.getByRole('button', { name: /previous step/i })).toBeDisabled();
    // jump to last step
    state.step('end');
    // re-render not required: state subscription drives an update
    expect(screen.getByRole('button', { name: /next step/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/MobileStepFooter.test.tsx`
Expected: FAIL — `MobileStepFooter` does not exist.

- [ ] **Step 3: Create the CSS module**

Write `src/components/MobileStepFooter.module.css`:

```css
.footer {
  display: flex;
  align-items: stretch;
  background: var(--bg-2);
  border-top: 1px solid var(--border);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--fg);
}
.btn {
  flex: 0 0 56px;
  min-height: 44px;
  background: var(--bg-3);
  border: none;
  border-right: 1px solid var(--border);
  color: var(--fg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: var(--mono);
}
.btn:last-of-type { border-right: none; border-left: 1px solid var(--border); }
.btn:disabled { color: var(--fg-dim); opacity: 0.5; cursor: not-allowed; }
.label {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 10px;
  min-width: 0;
}
.counter { font-weight: 600; }
.hint {
  color: var(--fg-dim);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
```

- [ ] **Step 4: Create the component**

Write `src/components/MobileStepFooter.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../state/store';
import { findingById, flowSteps } from '../content/loadContent';
import { basename } from '../util/path';
import styles from './MobileStepFooter.module.css';

export function MobileStepFooter() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const activeFlowIndex = useStore((s) => s.activeFlowIndex);
  const step = useStore((s) => s.step);

  if (!content || !activeFindingId) return null;
  const finding = findingById(content, activeFindingId);
  if (!finding) return null;
  const steps = flowSteps(finding, activeFlowIndex);
  if (steps.length === 0) return null;

  const cur = activeStepIndex ?? 0;
  const atStart = cur <= 0;
  const atEnd = cur >= steps.length - 1;
  const nextStepFile = atEnd ? null : steps[cur + 1].file;
  const nextFileChanges = nextStepFile && nextStepFile !== steps[cur].file;

  return (
    <div className={styles.footer} data-testid="mobile-step-footer">
      <button
        type="button"
        className={styles.btn}
        disabled={atStart}
        onClick={() => step('back')}
        aria-label="Previous step"
      >
        <ChevronLeft size={18} />
      </button>
      <div className={styles.label}>
        <span className={styles.counter}>{cur + 1}/{steps.length}</span>
        {nextFileChanges && (
          <span className={styles.hint} data-testid="mobile-step-next-file">
            → {basename(nextStepFile)}
          </span>
        )}
      </div>
      <button
        type="button"
        className={styles.btn}
        disabled={atEnd}
        onClick={() => step('next')}
        aria-label="Next step"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Confirm `basename` exists in `src/util/path`**

Run: `grep -n "export function basename" src/util/path.ts`
Expected output: matches an exported `basename` function. If it doesn't exist, replace the import with an inline `path.split('/').pop() ?? path` expression where `basename(nextStepFile)` is used.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/MobileStepFooter.test.tsx`
Expected: PASS — 4 tests pass.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/MobileStepFooter.tsx src/components/MobileStepFooter.module.css src/components/MobileStepFooter.test.tsx
git commit -m "feat: add MobileStepFooter with prev/next + counter + next-file hint"
```

---

## Task 5: TopBar — phone variant chrome

Split TopBar children into desktop-only and mobile-only groups using CSS classes. Add the ☰ button on mobile.

**Files:**
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/TopBar.module.css`
- Existing test: `src/components/TopBar.test.tsx` (verify it still passes)

- [ ] **Step 1: Update `TopBar.module.css`**

Append to `src/components/TopBar.module.css`:

```css
.menuBtn {
  flex: none;
  background: transparent;
  border: none;
  color: var(--fg);
  font-size: 20px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
}

@media (max-width: 640px) {
  .menuBtn { display: inline-flex; }
  .pill { display: none; }
  .version { display: none; }
  .brand .logo { height: 22px; }
}
```

(The `.menuBtn` is hidden by default and shown only below the breakpoint. `.pill` is the theme toggle button — moved to the drawer footer on mobile. `.version` is the analyzer version chip — also moved to the drawer.)

- [ ] **Step 2: Update `TopBar.tsx` to render the menu button**

Edit `src/components/TopBar.tsx`. Replace the existing function body so the menu button is rendered before the brand link, wired to `toggleSidebar`:

```tsx
import { Menu, Star, Terminal } from 'lucide-react';
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
  const sidebarView = useStore((s) => s.sidebarView);
  const setSidebarView = useStore((s) => s.setSidebarView);

  const semver = tool?.semanticVersion ? `v${tool.semanticVersion}` : null;
  const buildVer = tool?.version ? tool.version.replace(/^analyzer\//, '') : null;
  const label = [semver, buildVer].filter(Boolean).join(' · ');

  const openDrawer = () => setSidebarView(sidebarView ?? 'findings');

  return (
    <div className={styles.bar} data-testid="top-bar">
      <button
        type="button"
        className={styles.menuBtn}
        onClick={openDrawer}
        aria-label="Open menu"
        data-testid="top-bar-menu"
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <a className={styles.brand} href={SITE_URL} target="_blank" rel="noreferrer">
        <img
          className={styles.logo}
          src={theme === 'dark' ? logoDark : logoLight}
          alt="OpenTaint"
          width={141}
          height={26}
        />
      </a>
      {label && (
        <span
          className={styles.version}
          data-testid="tool-version"
          title={`${tool?.name ?? ''}${tool?.version ? ' ' + tool.version : ''}`.trim()}
        >
          {label}
        </span>
      )}
      <span className={styles.grow} />
      <button
        className={styles.pill}
        aria-label="Toggle theme"
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={toggleTheme}
      >
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

(The desktop visible structure is identical to before. The new `.menuBtn` element is hidden by `display: none` above the breakpoint and only appears under `@media (max-width: 640px)`.)

- [ ] **Step 3: Run the existing TopBar tests**

Run: `npx vitest run src/components/TopBar.test.tsx`
Expected: PASS — existing tests still pass (the menu button is added but doesn't conflict with anything tested).

- [ ] **Step 4: Add a test for the menu button click**

Append to `src/components/TopBar.test.tsx` (open it first to confirm imports; mirror existing test style):

```tsx
it('the menu button opens the drawer by setting sidebarView', async () => {
  useStore.getState().setSidebarView(null);
  render(<TopBar />);
  await userEvent.click(screen.getByTestId('top-bar-menu'));
  expect(useStore.getState().sidebarView).not.toBeNull();
});
```

- [ ] **Step 5: Run the new test**

Run: `npx vitest run src/components/TopBar.test.tsx`
Expected: PASS — the new test passes alongside the existing ones.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/TopBar.tsx src/components/TopBar.module.css src/components/TopBar.test.tsx
git commit -m "feat: add mobile menu button to TopBar; hide theme/version below 640px"
```

---

## Task 6: MobileShell — assemble the phone layout

The shell wires together the TopBar, top tabs (Code / Details / Rule), context strip, active content router, step footer, and drawer.

**Files:**
- Create: `src/components/MobileShell.tsx`
- Create: `src/components/MobileShell.module.css`
- Test: `src/components/MobileShell.test.tsx` (new)

- [ ] **Step 1: Write the failing tests**

Create `src/components/MobileShell.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import { MobileShell } from './MobileShell';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

beforeEach(() => {
  useStore.getState().reset();
  useStore.getState().loadContent(loadContent());
});

describe('MobileShell', () => {
  it('renders TopBar, top tabs, context strip, and step footer', () => {
    render(<MobileShell />);
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-context-strip')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-step-footer')).toBeInTheDocument();
  });

  it('defaults to the Code tab', () => {
    render(<MobileShell />);
    expect(screen.getByTestId('mobile-tab-code')).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Details and shows Info / Steps sub-tabs', async () => {
    render(<MobileShell />);
    await userEvent.click(screen.getByTestId('mobile-tab-details'));
    expect(useStore.getState().mobileTab).toBe('details');
    expect(screen.getByTestId('info-tab-info')).toBeInTheDocument();
    expect(screen.getByTestId('info-tab-steps')).toBeInTheDocument();
  });

  it('switches to Rule tab', async () => {
    render(<MobileShell />);
    await userEvent.click(screen.getByTestId('mobile-tab-rule'));
    expect(useStore.getState().mobileTab).toBe('rule');
  });

  it('opens the drawer when the TopBar menu is tapped', async () => {
    useStore.setState({ sidebarView: null });
    render(<MobileShell />);
    expect(screen.queryByTestId('mobile-drawer')).toBeNull();
    await userEvent.click(screen.getByTestId('top-bar-menu'));
    expect(screen.getByTestId('mobile-drawer')).toBeInTheDocument();
  });

  it('closes the drawer when a finding is selected from inside it', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileShell />);
    expect(screen.getByTestId('mobile-drawer')).toBeInTheDocument();
    // Pick the first finding in the tree.
    const findingButtons = screen.getAllByTestId(/^finding-/);
    await userEvent.click(findingButtons[0]);
    expect(useStore.getState().sidebarView).toBeNull();
    expect(useStore.getState().mobileTab).toBe('code');
  });
});
```

> The `finding-` testid prefix matches `FindingsTree`'s existing rendering — confirm with `grep -n "data-testid" src/components/FindingsTree.tsx` before running tests. If the testid pattern is different, update the selector to match.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/MobileShell.test.tsx`
Expected: FAIL — `MobileShell` does not exist.

- [ ] **Step 3: Create the CSS module**

Write `src/components/MobileShell.module.css`:

```css
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.tabs {
  display: flex;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  font-family: var(--mono);
}
.tab {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--fg-dim);
  padding: 10px 0;
  font-size: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font-family: var(--mono);
}
.tab.active { color: var(--fg); border-bottom-color: var(--accent); background: var(--bg-3); }
.context {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border);
  padding: 5px 12px;
  font-size: 11px;
  color: var(--fg-dim);
  font-family: var(--mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.context strong { color: var(--fg); font-weight: 600; }
.content { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.subTabs { display: flex; background: var(--bg-2); border-bottom: 1px solid var(--border); }
.subTab {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--fg-dim);
  padding: 8px 0;
  font-size: 11px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font-family: var(--mono);
}
.subTab.active { color: var(--fg); border-bottom-color: var(--accent); }
.pane { flex: 1; min-height: 0; overflow: auto; }
```

- [ ] **Step 4: Create the shell**

Write `src/components/MobileShell.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { findingById } from '../content/loadContent';
import { CodeView } from './CodeView';
import { RulesView } from './RulesView';
import { FindingInfo } from './FindingInfo';
import { StepsList } from './StepsList';
import { TopBar } from './TopBar';
import { MobileDrawer } from './MobileDrawer';
import { MobileStepFooter } from './MobileStepFooter';
import styles from './MobileShell.module.css';

export function MobileShell() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const mobileTab = useStore((s) => s.mobileTab);
  const setMobileTab = useStore((s) => s.setMobileTab);
  const infoTab = useStore((s) => s.infoTab);
  const setInfoTab = useStore((s) => s.setInfoTab);

  // Auto-close the drawer when the user picks a tree node. The trees mutate the
  // store directly (selectFinding / selectRule), so we react to those changes here
  // rather than threading callbacks through the tree components.
  const lastSelectionRef = useRef<{ findingId: string | null; ruleId: string | null }>({
    findingId: activeFindingId,
    ruleId: useStore.getState().activeRuleId,
  });
  useEffect(() => useStore.subscribe((s) => {
    const prev = lastSelectionRef.current;
    const fChanged = s.activeFindingId !== prev.findingId;
    const rChanged = s.activeRuleId !== prev.ruleId;
    lastSelectionRef.current = { findingId: s.activeFindingId, ruleId: s.activeRuleId };
    if ((fChanged || rChanged) && s.sidebarView !== null) {
      // Close the drawer and steer the mobile tab to wherever the new selection lives.
      s.setSidebarView(null);
      s.setMobileTab(fChanged ? 'code' : 'rule');
    }
  }), []);

  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  const contextLabel = finding ? `${finding.vulnClass} — ${finding.location ?? ''}` : '';

  const tabs: Array<{ id: 'code' | 'details' | 'rule'; label: string }> = [
    { id: 'code', label: 'Code' },
    { id: 'details', label: 'Details' },
    { id: 'rule', label: 'Rule' },
  ];

  return (
    <div className={styles.shell} data-testid="mobile-shell">
      <TopBar />
      <div className={styles.tabs} role="tablist" aria-label="Mobile view" data-testid="mobile-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mobileTab === t.id}
            data-testid={`mobile-tab-${t.id}`}
            className={`${styles.tab} ${mobileTab === t.id ? styles.active : ''}`}
            onClick={() => setMobileTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {contextLabel && (
        <div className={styles.context} data-testid="mobile-context-strip">
          <strong>{finding!.vulnClass}</strong>{finding?.location ? ` — ${finding.location}` : ''}
        </div>
      )}
      <div className={styles.content}>
        {mobileTab === 'code' && (
          <div className={styles.pane}><CodeView /></div>
        )}
        {mobileTab === 'details' && (
          <>
            <div className={styles.subTabs} role="tablist" aria-label="Finding details">
              <button
                type="button"
                role="tab"
                aria-selected={infoTab === 'info'}
                data-testid="info-tab-info"
                className={`${styles.subTab} ${infoTab === 'info' ? styles.active : ''}`}
                onClick={() => setInfoTab('info')}
              >
                Info
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={infoTab === 'steps'}
                data-testid="info-tab-steps"
                className={`${styles.subTab} ${infoTab === 'steps' ? styles.active : ''}`}
                onClick={() => setInfoTab('steps')}
              >
                Steps
              </button>
            </div>
            <div className={styles.pane}>
              {infoTab === 'info' ? <FindingInfo /> : <StepsList />}
            </div>
          </>
        )}
        {mobileTab === 'rule' && (
          <div className={styles.pane}><RulesView /></div>
        )}
      </div>
      <MobileStepFooter />
      <MobileDrawer />
    </div>
  );
}
```

- [ ] **Step 5: Verify the FindingInfo / StepsList testids match**

Run: `grep -n "data-testid" src/components/FindingInfo.tsx src/components/StepsList.tsx`
Expected: no `info-tab-*` testids inside those components — those testids are on the *containers* (already-existing in `InfoPanel.tsx` test setup). MobileShell adds them on its sub-tab buttons, which is what the tests check.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/MobileShell.test.tsx`
Expected: PASS — 6 tests pass.

If the auto-close test fails because the `finding-` testid pattern differs, run:

```
grep -n "data-testid" src/components/FindingsTree.tsx | head -5
```

and update the selector in the test accordingly.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/MobileShell.tsx src/components/MobileShell.module.css src/components/MobileShell.test.tsx
git commit -m "feat: assemble MobileShell with top tabs, context strip, drawer, step footer"
```

---

## Task 7: AppShell — render both shells with a CSS media toggle

`AppShell` now mounts both `DesktopShell` and `MobileShell`. CSS hides whichever doesn't match the viewport.

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AppShell.module.css`
- Existing tests: `src/App.test.tsx` (must still pass)

- [ ] **Step 1: Add the `.desktop` / `.mobile` wrappers to `AppShell.module.css`**

Append to `src/components/AppShell.module.css`:

```css
.desktop, .mobile { height: 100%; }

@media (min-width: 641px) {
  .mobile { display: none; }
}
@media (max-width: 640px) {
  .desktop { display: none; }
}
```

- [ ] **Step 2: Update `AppShell.tsx` to mount both shells**

Overwrite `src/components/AppShell.tsx`:

```tsx
import { useEffect } from 'react';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';
import { useStepKeys } from './useStepKeys';
import { useTheme } from '../state/theme';
import styles from './AppShell.module.css';

export function AppShell() {
  const theme = useTheme((s) => s.theme);
  useStepKeys();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <div className={styles.desktop}><DesktopShell /></div>
      <div className={styles.mobile}><MobileShell /></div>
    </>
  );
}
```

- [ ] **Step 3: Run the existing app smoke test**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS — both existing tests still pass. (jsdom doesn't apply @media, so both shells render in tests — `getByTestId('top-bar')` and `getByTestId('findings-tree')` will match the desktop shell, which still hosts them.)

> If `getByTestId('top-bar')` throws "found multiple elements", switch the assertion to `getAllByTestId('top-bar').length` `>= 1`. The two shells each render a TopBar, and that's intentional — CSS controls which one is visible. Update existing assertions accordingly:
>
> - `expect(screen.getByTestId('top-bar'))` → `expect(screen.getAllByTestId('top-bar').length).toBeGreaterThan(0)`
> - `expect(screen.getByTestId('findings-tree'))` → `getAllByTestId(...)` similarly
> - `expect(screen.getByTestId('editor-area'))` → `getAllByTestId(...)` similarly
> - `screen.queryByTestId('rules-tree')` → `screen.queryAllByTestId('rules-tree')` (assert `.length === 0`)
>
> Each change is mechanical: `getByTestId` / `queryByTestId` → their `All` cousins, then assert on length.

- [ ] **Step 4: Update `App.test.tsx` for the dual-shell render**

Open `src/App.test.tsx` and apply the testid changes above. Example diff for the first test:

```tsx
it('renders the shell with a finding visible on first paint', () => {
  render(<App />);
  expect(screen.getAllByTestId('top-bar').length).toBeGreaterThan(0);
  expect(screen.getAllByTestId('findings-tree').length).toBeGreaterThan(0);
  expect(screen.getAllByText(active.location!).length).toBeGreaterThan(0);
  expect(screen.getAllByTestId('editor-area').length).toBeGreaterThan(0);
});
```

And for the second test:

```tsx
it('switches the sidebar between Findings and Rules from the activity bar (mutually exclusive)', async () => {
  render(<App />);
  expect(screen.getAllByTestId('findings-tree').length).toBeGreaterThan(0);
  expect(screen.queryAllByTestId('rules-tree').length).toBe(0);

  await userEvent.click(screen.getByTestId('activity-rules'));
  expect(screen.getAllByTestId('rules-tree').length).toBeGreaterThan(0);
  expect(screen.queryAllByTestId('findings-tree').length).toBe(0);

  await userEvent.click(screen.getByTestId('activity-rules'));
  expect(screen.queryAllByTestId('rules-tree').length).toBe(0);
  expect(screen.queryAllByTestId('findings-tree').length).toBe(0);
});
```

- [ ] **Step 5: Re-run the suite**

Run: `npx vitest run`
Expected: all tests pass — including the new MobileShell / MobileDrawer / MobileStepFooter / TopBar tests and the updated App.test.tsx.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/AppShell.tsx src/components/AppShell.module.css src/App.test.tsx
git commit -m "feat: AppShell mounts both Desktop and Mobile shells, CSS toggles visibility"
```

---

## Task 8: CodeView — phone Monaco overrides via one-shot matchMedia

At editor mount, read `window.matchMedia('(max-width: 640px)').matches`. If true, merge in phone-friendly Monaco options. This is the only JS-side viewport read in the project.

**Files:**
- Modify: `src/components/CodeView.tsx`

- [ ] **Step 1: Add the override helper at the top of CodeView**

In `src/components/CodeView.tsx`, just below the existing `MONACO_LANG` constant (~line 13), add:

```ts
function phoneEditorOverrides(): Record<string, unknown> {
  const matches =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 640px)').matches;
  if (!matches) return {};
  return {
    readOnly: true,
    minimap: { enabled: false },
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    fontSize: 13,
  };
}
```

- [ ] **Step 2: Merge the overrides into the editor options**

In the `<Editor>` JSX (~line 161), spread the overrides last so they win:

```tsx
options={{
  readOnly: true,
  minimap: { enabled: false },
  glyphMargin: true,
  fontSize: 13,
  fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  automaticLayout: true,
  hover: { enabled: true, delay: 0 },
  ...phoneEditorOverrides(),
}}
```

> The desktop defaults overlap with several override fields (`readOnly`, `minimap`, `fontSize`). Spreading `phoneEditorOverrides()` last is a no-op above the breakpoint (empty object) and applies the phone profile below it.

- [ ] **Step 3: Add a test for the override helper**

Append to `src/components/CodeView.test.tsx`:

```tsx
import { phoneEditorOverrides } from './CodeView';  // requires exporting it

// (move this above other imports if your test file groups them)
```

If the helper is non-exported, change `function phoneEditorOverrides()` to `export function phoneEditorOverrides()` in `CodeView.tsx`.

Test:

```tsx
describe('phoneEditorOverrides', () => {
  const origMM = window.matchMedia;
  afterEach(() => { window.matchMedia = origMM; });

  it('returns {} when matchMedia does not match', () => {
    window.matchMedia = (() => ({
      matches: false, media: '', onchange: null,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
      dispatchEvent() { return false; },
    })) as unknown as typeof window.matchMedia;
    expect(phoneEditorOverrides()).toEqual({});
  });

  it('returns phone overrides when matchMedia matches', () => {
    window.matchMedia = (() => ({
      matches: true, media: '', onchange: null,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
      dispatchEvent() { return false; },
    })) as unknown as typeof window.matchMedia;
    expect(phoneEditorOverrides()).toMatchObject({
      readOnly: true,
      minimap: { enabled: false },
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      fontSize: 13,
    });
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/CodeView.test.tsx`
Expected: PASS — existing CodeView tests still pass, plus 2 new helper tests.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/CodeView.tsx src/components/CodeView.test.tsx
git commit -m "feat: apply phone Monaco overrides via matchMedia at editor mount"
```

---

## Task 9: E2E — Playwright golden path at iPhone-14 viewport

A single new spec walks the mobile happy path: load → drawer → pick a finding → drawer closes → swap to Details → tap Steps → tap a step → Code activates → tap step footer Next.

**Files:**
- Create: `e2e/mobile.spec.ts`
- Modify: `playwright.config.ts`
- Modify (probably): `package.json` (no test script change required — `npm run e2e` runs all specs)

- [ ] **Step 1: Add a mobile project to the Playwright config**

Edit `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: { command: 'npm run dev -- --port 5174', url: 'http://localhost:5174', reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://localhost:5174' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /playground\.spec\.ts/ },
    { name: 'mobile',  use: { ...devices['iPhone 14'] },      testMatch: /mobile\.spec\.ts/ },
  ],
});
```

This keeps the existing `playground.spec.ts` on Desktop Chrome and runs the new mobile spec on the iPhone 14 device profile.

- [ ] **Step 2: Read the existing playground spec for style**

Run: `cat e2e/playground.spec.ts`
Read enough to mirror its conventions (locators, asserts, `await page.goto('/')`, etc.). Match its style.

- [ ] **Step 3: Write the mobile spec**

Create `e2e/mobile.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('mobile golden path: drawer → finding → details/steps → step footer', async ({ page }) => {
  await page.goto('/');

  // The mobile shell is visible at the configured viewport.
  await expect(page.getByTestId('mobile-shell')).toBeVisible();

  // Open the drawer from the TopBar menu.
  await page.getByTestId('top-bar-menu').tap();
  await expect(page.getByTestId('mobile-drawer')).toBeVisible();
  await expect(page.getByTestId('findings-tree')).toBeVisible();

  // Tap the first finding. Drawer closes; the Code tab is active.
  const firstFinding = page.locator('[data-testid^="finding-"]').first();
  await firstFinding.tap();
  await expect(page.getByTestId('mobile-drawer')).not.toBeVisible();
  await expect(page.getByTestId('mobile-tab-code')).toHaveAttribute('aria-selected', 'true');

  // Swap to Details and confirm the Info/Steps sub-tabs are present.
  await page.getByTestId('mobile-tab-details').tap();
  await expect(page.getByTestId('info-tab-info')).toBeVisible();
  await expect(page.getByTestId('info-tab-steps')).toBeVisible();

  // Tap Steps; expect the steps list to render.
  await page.getByTestId('info-tab-steps').tap();
  await expect(page.getByTestId('steps-list')).toBeVisible();

  // Tap step footer Next; expect to remain on Details (no surprise tab switch).
  await page.getByRole('button', { name: 'Next step' }).tap();
  await expect(page.getByTestId('mobile-tab-details')).toHaveAttribute('aria-selected', 'true');
});
```

> If `steps-list` is not the testid used by `StepsList`, run `grep -n "data-testid" src/components/StepsList.tsx` and update.

- [ ] **Step 4: Run the new spec**

Run: `npm run e2e -- --project=mobile`
Expected: PASS — the mobile golden-path spec passes.

If a `data-testid` doesn't match what the component renders, fix the selector and re-run.

- [ ] **Step 5: Run the full e2e suite to confirm desktop hasn't regressed**

Run: `npm run e2e`
Expected: PASS — both `desktop` and `mobile` projects pass.

- [ ] **Step 6: Run the full unit suite to confirm nothing else regressed**

Run: `npx vitest run`
Expected: PASS — all unit/component tests pass.

- [ ] **Step 7: Run the build to confirm no TypeScript errors leaked**

Run: `npm run build`
Expected: PASS — `tsc --noEmit` succeeds and Vite produces `dist/`.

- [ ] **Step 8: Commit**

```bash
git add e2e/mobile.spec.ts playwright.config.ts
git commit -m "test: e2e golden path for mobile view at iPhone-14 viewport"
```

---

## Self-review

**Spec coverage:**

- Goal (full feature access, no split views on phone) → Tasks 6 (MobileShell), 1 (mobileTab).
- Non-goals: documented in spec, not coded — nothing to plan.
- Breakpoint (CSS-only switch + one-shot matchMedia for Monaco) → Tasks 7 (AppShell), 8 (CodeView).
- Layout structure (TopBar / tabs / context strip / content / step footer) → Task 6.
- TopBar (phone variant: ☰ + logo + Star + Install) → Task 5.
- Drawer (overlay, segmented Findings/Rules, theme + version footer, scrim/✕/Escape/tree-tap close) → Task 3 (drawer body including Escape via `useEffect` keydown) and Task 6 Step 4 (auto-close on tree tap).
- Top tabs (Code / Details / Rule with nested Info/Steps) → Task 6.
- Step navigation footer (visible when findings > 0, ≥44×44 taps, Prev/Next, file-change hint) → Task 4.
- CodeView on phone (Monaco overrides) → Task 8.
- State model (`mobileTab`, persistence guard, derived drawer open state) → Task 1.
- Rendering strategy (both shells mounted, CSS toggle) → Task 7.
- Files added / changed table → all covered by tasks 1–9.
- Testing surface (unit + e2e at iPhone 14) → Tasks 1, 3, 4, 5, 6, 8, 9.

**Gap found and fixed:** Escape-key drawer close was in the spec but missing from the first draft of Task 3. Added a `useEffect` keydown listener inside `MobileDrawer` and a matching test ("closes the drawer when Escape is pressed"). Updated the post-test count in Step 5 from 5 to 6.

**Placeholder scan:** No "TBD", no "add error handling", no naked "implement later". The earlier `void [...]` workaround in Task 6 was replaced by simply not destructuring the unused store fields.

**Type consistency:**
- `MobileTab = 'code' | 'details' | 'rule'` — used identically across Task 1 (store), Task 6 (MobileShell), Task 9 (e2e testid suffixes).
- `mobileTab` field and `setMobileTab` action names used consistently from Task 1 through Task 9.
- `phoneEditorOverrides()` exported from CodeView in Task 8 Step 3, imported in the test in the same step.
- Testid pattern `mobile-tab-<id>` used in MobileShell (Task 6) and asserted in the e2e (Task 9).
- Tree testid pattern `finding-` is *assumed*; both tests (Task 6 and Task 9) include a `grep` step to verify before running.

No naming drift detected.
