import { describe, it, expect } from 'vitest';
import { encodeViewState, decodeViewState, type ViewState } from './permalink';

const v: ViewState = {
  scenarioId: 'sqli', findingId: 'sqli-0', stepIndex: 3,
  file: 'UserRepository.java', ruleId: 'sqli', viewMode: 'split', activeTab: 'rules',
};

describe('permalink codec', () => {
  it('round-trips a view state', () => {
    expect(decodeViewState(encodeViewState(v))).toEqual(v);
  });

  it('returns null for malformed input', () => {
    expect(decodeViewState('not-base64-$$')).toBeNull();
    expect(decodeViewState('')).toBeNull();
  });
});
