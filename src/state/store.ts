import { create } from 'zustand';
import type { PlaygroundContent } from '../types/content';
import { findingById } from '../content/loadContent';
import { navigate, type StepOp } from '../taint/nav';

export type ViewMode = 'tabs' | 'split';
export type EditorTab = 'code' | 'rules';

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
  reset: () => void;
}

const initial: State = {
  content: null, scenarioId: null, activeFindingId: null, activeStepIndex: null,
  activeFile: null, activeRuleId: null, activeRuleAnchor: null, ruleFocusTick: 0, viewMode: 'tabs', activeTab: 'code',
};

export const useStore = create<State & Actions>((set, get) => ({
  ...initial,

  loadContent: (content) => {
    const scenario = content.scenarios[0] ?? null;
    set({
      content,
      scenarioId: scenario?.id ?? null,
      activeFindingId: scenario?.defaultFindingId ?? null,
      activeStepIndex: scenario ? 0 : null,
      activeFile: scenario?.startFile ?? null,
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
    set({ activeFindingId: id, activeStepIndex: 0, activeFile: f?.steps[0]?.file ?? get().activeFile, activeTab: 'code' });
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
  reset: () => set({ ...initial }),
}));
