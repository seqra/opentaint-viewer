import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { ViewerContent } from '../types/content';
import { findingById } from '../content/loadContent';
import { navigate, type StepOp } from '../taint/nav';

export type ViewMode = 'tabs' | 'split';
export type EditorTab = 'code' | 'rules';
/** Which tree the left sidebar shows; null when collapsed. */
export type SidebarView = 'findings' | 'rules';
/** Which tab the lower info panel shows. */
export type InfoTab = 'info' | 'steps';

interface State {
  content: ViewerContent | null;
  scenarioId: string | null;
  activeFindingId: string | null;
  activeStepIndex: number | null;
  activeFile: string | null;
  activeRuleId: string | null;
  /** Rule id to scroll to within the active rule file (a file holds many rules). */
  activeRuleAnchor: string | null;
  /** Bumped on every selectRule call so the editor re-focuses even when the file/anchor are unchanged. */
  ruleFocusTick: number;
  viewMode: ViewMode;
  activeTab: EditorTab;
  /** Active left-sidebar tree, or null when collapsed. */
  sidebarView: SidebarView | null;
  /** Active lower-panel tab. */
  infoTab: InfoTab;
  /** Lower-panel layout: one tabbed pane, or Info + Steps split side by side. */
  infoViewMode: ViewMode;
}

interface Actions {
  loadContent: (c: ViewerContent) => void;
  selectScenario: (id: string) => void;
  selectFinding: (id: string) => void;
  selectStep: (findingId: string, index: number) => void;
  step: (op: StepOp) => void;
  selectFile: (path: string) => void;
  selectRule: (id: string, anchor?: string | null) => void;
  setViewMode: (m: ViewMode) => void;
  setActiveTab: (t: EditorTab) => void;
  /** Open `view`, or collapse the sidebar when `view` is already active. */
  toggleSidebar: (view: SidebarView) => void;
  setSidebarView: (view: SidebarView | null) => void;
  setInfoTab: (tab: InfoTab) => void;
  setInfoViewMode: (m: ViewMode) => void;
  reset: () => void;
}

const initial: State = {
  content: null, scenarioId: null, activeFindingId: null, activeStepIndex: null,
  activeFile: null, activeRuleId: null, activeRuleAnchor: null, ruleFocusTick: 0, viewMode: 'tabs', activeTab: 'code',
  sidebarView: 'findings', infoTab: 'info', infoViewMode: 'tabs',
};

/** The slice persisted to localStorage — the view, not the bundled content or transient focus. */
type PersistedView = Pick<
  State,
  'scenarioId' | 'activeFindingId' | 'activeStepIndex' | 'activeFile' | 'activeRuleId'
  | 'activeTab' | 'sidebarView' | 'infoTab' | 'viewMode' | 'infoViewMode'
>;

const oneOf = <T,>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** localStorage that degrades to a no-op when unavailable (tests, SSR, private mode). */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      /* storage unavailable */
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      /* storage unavailable */
    }
  },
};

/** Curated default focus: the default finding's last step (the sink). */
function defaultFocus(content: ViewerContent) {
  const scenario = content.scenarios[0] ?? null;
  const finding = scenario ? findingById(content, scenario.defaultFindingId) : undefined;
  const lastIdx = finding ? Math.max(0, finding.steps.length - 1) : null;
  return {
    scenarioId: scenario?.id ?? null,
    activeFindingId: scenario?.defaultFindingId ?? null,
    activeStepIndex: lastIdx,
    activeFile: finding?.steps[lastIdx ?? 0]?.file ?? scenario?.startFile ?? null,
    activeRuleId: content.rules[0]?.id ?? null,
  };
}

export const useStore = create<State & Actions>()(persist((set, get) => ({
  ...initial,

  loadContent: (content) => {
    const s = get();
    // Restore the saved navigation (from localStorage) when it's still valid for this content;
    // otherwise land on the curated default. Layout (tabs/split/sidebar) is restored by the
    // persist middleware and needs no content check.
    const savedFinding = s.activeFindingId ? findingById(content, s.activeFindingId) : undefined;
    const stepOk =
      savedFinding != null &&
      typeof s.activeStepIndex === 'number' &&
      s.activeStepIndex >= 0 &&
      s.activeStepIndex < savedFinding.steps.length;

    if (savedFinding && stepOk) {
      const fileOk = s.activeFile != null && content.files.some((f) => f.path === s.activeFile);
      const ruleOk = s.activeRuleId != null && content.rules.some((r) => r.id === s.activeRuleId);
      const scenarioOk = content.scenarios.some((sc) => sc.id === s.scenarioId);
      set({
        content,
        scenarioId: scenarioOk ? s.scenarioId : content.scenarios[0]?.id ?? null,
        activeFindingId: s.activeFindingId,
        activeStepIndex: s.activeStepIndex,
        activeFile: fileOk ? s.activeFile : savedFinding.steps[s.activeStepIndex!].file,
        activeRuleId: ruleOk ? s.activeRuleId : content.rules[0]?.id ?? null,
      });
      return;
    }

    set({ content, ...defaultFocus(content) });
  },

  selectScenario: (id) => {
    const c = get().content;
    const scenario = c?.scenarios.find((s) => s.id === id);
    if (!scenario) return;
    set({ scenarioId: id, activeFindingId: scenario.defaultFindingId, activeStepIndex: 0, activeFile: scenario.startFile });
  },

  selectFinding: (id) => {
    const c = get().content;
    const f = c ? findingById(c, id) : undefined;
    // Focus the last step (the sink) — the line the finding actually flags.
    const lastIdx = Math.max(0, (f?.steps.length ?? 1) - 1);
    set({ activeFindingId: id, activeStepIndex: lastIdx, activeFile: f?.steps[lastIdx]?.file ?? get().activeFile, activeTab: 'code' });
  },

  selectStep: (findingId, index) => {
    const c = get().content;
    const f = c ? findingById(c, findingId) : undefined;
    const step = f?.steps[index];
    set({ activeFindingId: findingId, activeStepIndex: index, activeFile: step?.file ?? get().activeFile, activeTab: 'code' });
  },

  step: (op) => {
    const c = get().content;
    const id = get().activeFindingId;
    const f = c && id ? findingById(c, id) : undefined;
    if (!f) return;
    const next = navigate(f.steps, get().activeStepIndex ?? 0, op);
    get().selectStep(f.id, next);
  },

  selectFile: (path) => set({ activeFile: path }),
  selectRule: (id, anchor = null) =>
    set((s) => ({ activeRuleId: id, activeRuleAnchor: anchor, activeTab: 'rules', ruleFocusTick: s.ruleFocusTick + 1 })),
  setViewMode: (viewMode) => set({ viewMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleSidebar: (view) => set((s) => ({ sidebarView: s.sidebarView === view ? null : view })),
  setSidebarView: (sidebarView) => set({ sidebarView }),
  setInfoTab: (infoTab) => set({ infoTab }),
  setInfoViewMode: (infoViewMode) => set({ infoViewMode }),
  reset: () => set({ ...initial }),
}), {
  name: 'ot-view',
  version: 1,
  storage: createJSONStorage(() => safeStorage),
  // Persist only the view slice (content is bundled; anchor/focus tick are transient).
  partialize: (s): PersistedView => ({
    scenarioId: s.scenarioId,
    activeFindingId: s.activeFindingId,
    activeStepIndex: s.activeStepIndex,
    activeFile: s.activeFile,
    activeRuleId: s.activeRuleId,
    activeTab: s.activeTab,
    sidebarView: s.sidebarView,
    infoTab: s.infoTab,
    viewMode: s.viewMode,
    infoViewMode: s.infoViewMode,
  }),
  // Validate enums on rehydrate so corrupt/old storage can't render an invalid view.
  merge: (persisted, current) => {
    const p = (persisted ?? {}) as Partial<PersistedView>;
    return {
      ...current,
      ...p,
      activeTab: oneOf(p.activeTab, ['code', 'rules'] as const, 'code'),
      sidebarView: p.sidebarView === null ? null : oneOf(p.sidebarView, ['findings', 'rules'] as const, 'findings'),
      infoTab: oneOf(p.infoTab, ['info', 'steps'] as const, 'info'),
      viewMode: oneOf(p.viewMode, ['tabs', 'split'] as const, 'tabs'),
      infoViewMode: oneOf(p.infoViewMode, ['tabs', 'split'] as const, 'tabs'),
    };
  },
}));
