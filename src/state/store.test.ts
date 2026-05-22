import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { loadContent } from '../content/loadContent';

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

  it('selectRule sets the active rule and switches tab to rules', () => {
    useStore.getState().loadContent(content);
    const rule = content.rules[0];
    useStore.getState().selectRule(rule.id);
    const s = useStore.getState();
    expect(s.activeRuleId).toBe(rule.id);
    expect(s.activeTab).toBe('rules');
  });
});
