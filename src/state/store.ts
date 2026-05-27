import { create } from 'zustand';
import type { PlaygroundContent } from '../types/content';
import { findingById } from '../content/loadContent';
import { navigate, type StepOp } from '../taint/nav';

export type ViewMode = 'tabs' | 'split';
export type EditorTab = 'code' | 'rules';
/** Which tree the left sidebar shows; null when collapsed. */
export type SidebarView = 'findings' | 'rules';
/** Which tab the lower info panel shows. */
export type InfoTab = 'info' | 'steps';

interface State {
  content: PlaygroundContent | null;
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
  loadContent: (c: PlaygroundContent) => void;
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

export const useStore = create<State & Actions>((set, get) => ({
  ...initial,

  loadContent: (content) => {
    const scenario = content.scenarios[0] ?? null;
    const finding = scenario ? findingById(content, scenario.defaultFindingId) : undefined;
    // Focus the last step (the sink) — the line the finding actually flags — so a refresh
    // lands where clicking the finding does, not on the source.
    const lastIdx = finding ? Math.max(0, finding.steps.length - 1) : null;
    set({
      content,
      scenarioId: scenario?.id ?? null,
      activeFindingId: scenario?.defaultFindingId ?? null,
      activeStepIndex: lastIdx,
      activeFile: finding?.steps[lastIdx ?? 0]?.file ?? scenario?.startFile ?? null,
      activeRuleId: content.rules[0]?.id ?? null,
    });
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
}));
