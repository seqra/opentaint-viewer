import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { ViewerContent } from '../types/content';
import { findingById, flowSteps } from '../content/loadContent';
import { navigate, type StepOp } from '../taint/nav';

export type ViewMode = 'tabs' | 'split';
export type EditorTab = 'code' | 'rules';
/** Which tree the left sidebar shows; null when collapsed. */
export type SidebarView = 'findings' | 'rules';
/** Which tab the lower info panel shows. */
export type InfoTab = 'info' | 'steps';

interface State {
  content: ViewerContent | null;
  activeFindingId: string | null;
  activeStepIndex: number | null;
  /** Which code flow of the active finding is shown (0-based). */
  activeFlowIndex: number;
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
  selectFinding: (id: string) => void;
  selectStep: (findingId: string, index: number) => void;
  step: (op: StepOp) => void;
  stepFlow: (op: 'prev' | 'next') => void;
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
  content: null, activeFindingId: null, activeStepIndex: null, activeFlowIndex: 0,
  activeFile: null, activeRuleId: null, activeRuleAnchor: null, ruleFocusTick: 0, viewMode: 'tabs', activeTab: 'code',
  sidebarView: 'findings', infoTab: 'info', infoViewMode: 'tabs',
};

/** The slice persisted to localStorage — the view, not the bundled content or transient focus. */
type PersistedView = Pick<
  State,
  'activeFindingId' | 'activeStepIndex' | 'activeFlowIndex' | 'activeFile' | 'activeRuleId'
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

/** Default focus: the first finding, its default flow, on the sink. */
function defaultFocus(content: ViewerContent) {
  const finding = content.findings[0] ?? null;
  const flowIndex = finding?.defaultFlowIndex ?? 0;
  const steps = finding ? flowSteps(finding, flowIndex) : [];
  const lastIdx = steps.length ? steps.length - 1 : null;
  return {
    activeFindingId: finding?.id ?? null,
    activeFlowIndex: flowIndex,
    activeStepIndex: lastIdx,
    activeFile: steps[lastIdx ?? 0]?.file ?? null,
    activeRuleId: content.rules[0]?.id ?? null,
  };
}

export const useStore = create<State & Actions>()(persist((set, get) => ({
  ...initial,

  loadContent: (content) => {
    const s = get();
    const savedFinding = s.activeFindingId ? findingById(content, s.activeFindingId) : undefined;
    if (savedFinding) {
      const flowOk =
        Number.isInteger(s.activeFlowIndex) && s.activeFlowIndex >= 0 && s.activeFlowIndex < savedFinding.flows.length;
      const flowIndex = flowOk ? s.activeFlowIndex : savedFinding.defaultFlowIndex;
      const steps = flowSteps(savedFinding, flowIndex);
      const stepOk =
        typeof s.activeStepIndex === 'number' && s.activeStepIndex >= 0 && s.activeStepIndex < steps.length;
      if (stepOk) {
        const fileOk = s.activeFile != null && content.files.some((f) => f.path === s.activeFile);
        const ruleOk = s.activeRuleId != null && content.rules.some((r) => r.id === s.activeRuleId);
        set({
          content,
          activeFindingId: s.activeFindingId,
          activeFlowIndex: flowIndex,
          activeStepIndex: s.activeStepIndex,
          activeFile: fileOk ? s.activeFile : steps[s.activeStepIndex!].file,
          activeRuleId: ruleOk ? s.activeRuleId : content.rules[0]?.id ?? null,
        });
        return;
      }
    }
    set({ content, ...defaultFocus(content) });
  },

  selectFinding: (id) => {
    const c = get().content;
    const f = c ? findingById(c, id) : undefined;
    const flowIndex = f?.defaultFlowIndex ?? 0;
    const steps = f ? flowSteps(f, flowIndex) : [];
    const lastIdx = Math.max(0, steps.length - 1);
    set({ activeFindingId: id, activeFlowIndex: flowIndex, activeStepIndex: lastIdx, activeFile: steps[lastIdx]?.file ?? get().activeFile, activeTab: 'code' });
  },

  selectStep: (findingId, index) => {
    const c = get().content;
    const f = c ? findingById(c, findingId) : undefined;
    const step = f ? flowSteps(f, get().activeFlowIndex)[index] : undefined;
    set({ activeFindingId: findingId, activeStepIndex: index, activeFile: step?.file ?? get().activeFile, activeTab: 'code' });
  },

  step: (op) => {
    const c = get().content;
    const id = get().activeFindingId;
    const f = c && id ? findingById(c, id) : undefined;
    if (!f) return;
    const next = navigate(flowSteps(f, get().activeFlowIndex), get().activeStepIndex ?? 0, op);
    get().selectStep(f.id, next);
  },

  stepFlow: (op) => {
    const c = get().content;
    const id = get().activeFindingId;
    const f = c && id ? findingById(c, id) : undefined;
    if (!f) return;
    const last = f.flows.length - 1;
    const cur = Math.min(last, Math.max(0, get().activeFlowIndex));
    const nextIdx = op === 'next' ? Math.min(last, cur + 1) : Math.max(0, cur - 1);
    const steps = f.flows[nextIdx].steps;
    const sink = Math.max(0, steps.length - 1);
    set({ activeFlowIndex: nextIdx, activeStepIndex: sink, activeFile: steps[sink]?.file ?? get().activeFile });
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
    activeFindingId: s.activeFindingId,
    activeStepIndex: s.activeStepIndex,
    activeFlowIndex: s.activeFlowIndex,
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
      activeFlowIndex: Number.isInteger(p.activeFlowIndex) && (p.activeFlowIndex as number) >= 0 ? (p.activeFlowIndex as number) : 0,
      activeTab: oneOf(p.activeTab, ['code', 'rules'] as const, 'code'),
      sidebarView: p.sidebarView === null ? null : oneOf(p.sidebarView, ['findings', 'rules'] as const, 'findings'),
      infoTab: oneOf(p.infoTab, ['info', 'steps'] as const, 'info'),
      viewMode: oneOf(p.viewMode, ['tabs', 'split'] as const, 'tabs'),
      infoViewMode: oneOf(p.infoViewMode, ['tabs', 'split'] as const, 'tabs'),
    };
  },
}));
