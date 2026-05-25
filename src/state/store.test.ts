import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { loadContent } from '../content/loadContent';
import { navigate } from '../taint/nav';

const content = loadContent();
const scenario = content.scenarios[0];
const multiStep = content.findings.find((f) => f.steps.length > 1)!;

describe('playground store', () => {
  beforeEach(() => useStore.getState().reset());

  it('loadContent selects the first scenario, its default finding, step 0, start file', () => {
    useStore.getState().loadContent(content);
    const s = useStore.getState();
    expect(s.scenarioId).toBe(scenario.id);
    expect(s.activeFindingId).toBe(scenario.defaultFindingId);
    expect(s.activeStepIndex).toBe(0);
    expect(s.activeFile).toBe(scenario.startFile);
    expect(s.viewMode).toBe('tabs');
    expect(s.activeTab).toBe('code');
  });

  it('selectStep updates step and switches the active file to the step file', () => {
    useStore.getState().loadContent(content);
    const lastIdx = multiStep.steps.length - 1;
    useStore.getState().selectStep(multiStep.id, lastIdx);
    const s = useStore.getState();
    expect(s.activeStepIndex).toBe(lastIdx);
    expect(s.activeFile).toBe(multiStep.steps[lastIdx].file);
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
    expect(useStore.getState().activeStepIndex).toBe(navigate(multiStep.steps, 0, 'next'));

    const overFrom = useStore.getState().activeStepIndex!;
    useStore.getState().step('nextOver');
    const expected = navigate(multiStep.steps, overFrom, 'nextOver');
    expect(useStore.getState().activeStepIndex).toBe(expected);
    expect(useStore.getState().activeFile).toBe(multiStep.steps[expected].file);
  });
});
