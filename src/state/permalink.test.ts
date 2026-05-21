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

  it('rejects a payload whose fields have the wrong types', () => {
    const encodeRaw = (obj: unknown) =>
      btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // findingId is a number, not string|null
    expect(decodeViewState(encodeRaw({
      scenarioId: 'sqli', findingId: 42, stepIndex: 3, file: 'A.java',
      ruleId: null, viewMode: 'split', activeTab: 'code',
    }))).toBeNull();

    // stepIndex is a string, not number|null
    expect(decodeViewState(encodeRaw({
      scenarioId: 'sqli', findingId: 'sqli-0', stepIndex: '3', file: 'A.java',
      ruleId: null, viewMode: 'tabs', activeTab: 'code',
    }))).toBeNull();

    // file is an array, not string|null
    expect(decodeViewState(encodeRaw({
      scenarioId: null, findingId: null, stepIndex: null, file: ['x'],
      ruleId: null, viewMode: 'tabs', activeTab: 'rules',
    }))).toBeNull();
  });
});
