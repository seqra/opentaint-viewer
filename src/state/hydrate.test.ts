import { describe, it, expect, beforeEach } from 'vitest';
import { hydrateFromHash } from './hydrate';
import { useStore } from './store';
import { loadContent } from '../content/loadContent';
import { encodeViewState, type ViewState } from './permalink';

describe('hydrateFromHash', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(loadContent());
  });

  it('restores store state from a valid encoded hash', () => {
    const v: ViewState = {
      scenarioId: 'sqli', findingId: 'sqli-0', stepIndex: 3,
      file: 'UserRepository.java', ruleId: 'sqli', viewMode: 'split', activeTab: 'rules',
    };
    hydrateFromHash('#' + encodeViewState(v));
    const s = useStore.getState();
    expect(s.viewMode).toBe('split');
    expect(s.activeTab).toBe('rules');
    expect(s.activeStepIndex).toBe(3);
    expect(s.activeFile).toBe('UserRepository.java');
    expect(s.activeRuleId).toBe('sqli');
  });

  it('is a no-op for a garbage hash (does not throw or change state)', () => {
    const before = useStore.getState();
    const snapshot = {
      viewMode: before.viewMode,
      activeTab: before.activeTab,
      activeStepIndex: before.activeStepIndex,
      activeFile: before.activeFile,
    };
    expect(() => hydrateFromHash('#not-valid-$$')).not.toThrow();
    const after = useStore.getState();
    expect(after.viewMode).toBe(snapshot.viewMode);
    expect(after.activeTab).toBe(snapshot.activeTab);
    expect(after.activeStepIndex).toBe(snapshot.activeStepIndex);
    expect(after.activeFile).toBe(snapshot.activeFile);
  });
});
