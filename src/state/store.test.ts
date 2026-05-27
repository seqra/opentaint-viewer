import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { loadContent } from '../content/loadContent';
import { navigate } from '../taint/nav';

const content = loadContent();
const scenario = content.scenarios[0];
const stepsOf = (f: typeof content.findings[number]) => f.flows[f.defaultFlowIndex].steps;
const multiStep = content.findings.find((f) => stepsOf(f).length > 1)!;
const multiFlow = content.findings.find((f) => f.flows.length > 1)!;

describe('viewer store', () => {
  beforeEach(() => useStore.getState().reset());

  it('loadContent selects the first scenario, its default finding, focused on the sink (last step)', () => {
    useStore.getState().loadContent(content);
    const s = useStore.getState();
    const defaultFinding = content.findings.find((f) => f.id === scenario.defaultFindingId)!;
    const lastIdx = defaultFinding.flows[defaultFinding.defaultFlowIndex].steps.length - 1;
    expect(s.scenarioId).toBe(scenario.id);
    expect(s.activeFindingId).toBe(scenario.defaultFindingId);
    expect(s.activeStepIndex).toBe(lastIdx);
    expect(s.activeFile).toBe(defaultFinding.flows[defaultFinding.defaultFlowIndex].steps[lastIdx].file);
    expect(s.viewMode).toBe('tabs');
    expect(s.activeTab).toBe('code');
  });

  it('loadContent restores saved navigation when it is still valid for the content', () => {
    // Simulate state rehydrated from localStorage before content loads.
    useStore.setState({ activeFindingId: multiStep.id, activeStepIndex: 1, activeFile: stepsOf(multiStep)[1].file, content: null });
    useStore.getState().loadContent(content);
    const s = useStore.getState();
    expect(s.activeFindingId).toBe(multiStep.id);
    expect(s.activeStepIndex).toBe(1);
    expect(s.activeFile).toBe(stepsOf(multiStep)[1].file);
  });

  it('loadContent falls back to the default sink when the saved finding/step is invalid', () => {
    useStore.setState({ activeFindingId: 'no-such-finding', activeStepIndex: 99, content: null });
    useStore.getState().loadContent(content);
    const s = useStore.getState();
    const defaultFinding = content.findings.find((f) => f.id === scenario.defaultFindingId)!;
    expect(s.activeFindingId).toBe(scenario.defaultFindingId);
    expect(s.activeStepIndex).toBe(defaultFinding.flows[defaultFinding.defaultFlowIndex].steps.length - 1);
  });

  it('selectFinding focuses the last step (the sink) and switches the active file to it', () => {
    useStore.getState().loadContent(content);
    const lastIdx = stepsOf(multiStep).length - 1;
    useStore.getState().selectFinding(multiStep.id);
    const s = useStore.getState();
    expect(s.activeFindingId).toBe(multiStep.id);
    expect(s.activeStepIndex).toBe(lastIdx);
    expect(s.activeFile).toBe(stepsOf(multiStep)[lastIdx].file);
    expect(s.activeTab).toBe('code');
  });

  it('selectStep updates step and switches the active file to the step file', () => {
    useStore.getState().loadContent(content);
    const lastIdx = stepsOf(multiStep).length - 1;
    useStore.getState().selectStep(multiStep.id, lastIdx);
    const s = useStore.getState();
    expect(s.activeStepIndex).toBe(lastIdx);
    expect(s.activeFile).toBe(stepsOf(multiStep)[lastIdx].file);
  });

  it('setViewMode and setActiveTab update view state immutably', () => {
    useStore.getState().loadContent(content);
    const before = useStore.getState();
    useStore.getState().setViewMode('split');
    useStore.getState().setActiveTab('rules');
    const after = useStore.getState();
    expect(after.viewMode).toBe('split');
    expect(after.activeTab).toBe('rules');
    expect(before.viewMode).toBe('tabs'); // snapshot unchanged
  });

  it('setInfoViewMode toggles the lower panel between tabbed and split', () => {
    useStore.getState().loadContent(content);
    expect(useStore.getState().infoViewMode).toBe('tabs'); // default
    useStore.getState().setInfoViewMode('split');
    expect(useStore.getState().infoViewMode).toBe('split');
    useStore.getState().setInfoViewMode('tabs');
    expect(useStore.getState().infoViewMode).toBe('tabs');
  });

  it('toggleSidebar opens a view, switches between views, and collapses on re-click', () => {
    useStore.getState().loadContent(content);
    expect(useStore.getState().sidebarView).toBe('findings'); // default
    useStore.getState().toggleSidebar('rules');
    expect(useStore.getState().sidebarView).toBe('rules');
    useStore.getState().toggleSidebar('rules'); // same view -> collapse
    expect(useStore.getState().sidebarView).toBeNull();
    useStore.getState().toggleSidebar('findings');
    expect(useStore.getState().sidebarView).toBe('findings');
  });

  it('selectRule sets the active rule, its anchor, and switches tab to rules', () => {
    useStore.getState().loadContent(content);
    const rule = content.rules[0];
    useStore.getState().selectRule(rule.id, 'java.security.ssti');
    const s = useStore.getState();
    expect(s.activeRuleId).toBe(rule.id);
    expect(s.activeRuleAnchor).toBe('java.security.ssti');
    expect(s.activeTab).toBe('rules');
  });

  it('selectRule re-requests focus on every call so re-clicking a link re-centers the rule', () => {
    useStore.getState().loadContent(content);
    useStore.getState().selectRule('java/security/code-injection.yaml', 'java.security.ssti');
    const first = useStore.getState().ruleFocusTick;
    // Identical arguments: nothing else in the store changes, but focus must re-fire.
    useStore.getState().selectRule('java/security/code-injection.yaml', 'java.security.ssti');
    expect(useStore.getState().ruleFocusTick).toBeGreaterThan(first);
  });

  it('step(op) navigates the active finding and follows the step file', () => {
    useStore.getState().loadContent(content);
    useStore.getState().selectStep(multiStep.id, 0);

    useStore.getState().step('next');
    expect(useStore.getState().activeStepIndex).toBe(navigate(stepsOf(multiStep), 0, 'next'));

    const overFrom = useStore.getState().activeStepIndex!;
    useStore.getState().step('nextOver');
    const expected = navigate(stepsOf(multiStep), overFrom, 'nextOver');
    expect(useStore.getState().activeStepIndex).toBe(expected);
    expect(useStore.getState().activeFile).toBe(stepsOf(multiStep)[expected].file);
  });

  it('loadContent sets activeFlowIndex to the default and focuses that flow\'s sink', () => {
    useStore.getState().loadContent(content);
    const s = useStore.getState();
    const f = content.findings.find((x) => x.id === scenario.defaultFindingId)!;
    expect(s.activeFlowIndex).toBe(f.defaultFlowIndex);
    expect(s.activeStepIndex).toBe(f.flows[f.defaultFlowIndex].steps.length - 1);
  });

  it('selectFinding resets the flow to the finding\'s default', () => {
    useStore.getState().loadContent(content);
    useStore.setState({ activeFlowIndex: 999 });
    useStore.getState().selectFinding(multiFlow.id);
    expect(useStore.getState().activeFlowIndex).toBe(multiFlow.defaultFlowIndex);
  });

  it('stepFlow moves between flows, clamps at the ends, and focuses the new flow\'s sink', () => {
    useStore.getState().loadContent(content);
    useStore.getState().selectFinding(multiFlow.id);
    useStore.setState({ activeFlowIndex: 1 });
    useStore.getState().stepFlow('prev');
    expect(useStore.getState().activeFlowIndex).toBe(0);
    useStore.getState().stepFlow('prev');
    expect(useStore.getState().activeFlowIndex).toBe(0); // clamped
    useStore.getState().stepFlow('next');
    const i = useStore.getState().activeFlowIndex;
    expect(i).toBe(1);
    expect(useStore.getState().activeStepIndex).toBe(multiFlow.flows[i].steps.length - 1);
  });

  it('loadContent clamps an out-of-range persisted activeFlowIndex to the default', () => {
    useStore.setState({ activeFindingId: multiFlow.id, activeFlowIndex: 99, activeStepIndex: 0, activeFile: multiFlow.flows[0].steps[0].file, content: null });
    useStore.getState().loadContent(content);
    expect(useStore.getState().activeFlowIndex).toBe(multiFlow.defaultFlowIndex);
  });
});
