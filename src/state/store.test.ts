import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { loadContent } from '../content/loadContent';

const content = loadContent();

describe('playground store', () => {
  beforeEach(() => useStore.getState().reset());

  it('loadContent selects the first scenario, its default finding, step 0, start file', () => {
    useStore.getState().loadContent(content);
    const s = useStore.getState();
    expect(s.scenarioId).toBe('sqli');
    expect(s.activeFindingId).toBe('sqli-0');
    expect(s.activeStepIndex).toBe(0);
    expect(s.activeFile).toBe('UserController.java');
    expect(s.viewMode).toBe('tabs');
    expect(s.activeTab).toBe('code');
  });

  it('selectStep updates step and switches the active file to the step file', () => {
    useStore.getState().loadContent(content);
    useStore.getState().selectStep('sqli-0', 3);
    const s = useStore.getState();
    expect(s.activeStepIndex).toBe(3);
    expect(s.activeFile).toBe('UserRepository.java');
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
    useStore.getState().selectRule('sqli');
    const s = useStore.getState();
    expect(s.activeRuleId).toBe('sqli');
    expect(s.activeTab).toBe('rules');
  });
});
