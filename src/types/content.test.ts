import { describe, it, expect } from 'vitest';
import { isPlaygroundContent } from './content';

describe('isPlaygroundContent', () => {
  it('accepts a minimal valid content object', () => {
    const c = {
      projectId: 'java-spring-demo',
      scenarios: [{ id: 's1', title: 'SQLi', blurb: 'b', startFile: 'A.java', defaultFindingId: 'f1' }],
      files: [{ path: 'A.java', language: 'java', content: '...' }],
      findings: [{ id: 'f1', ruleId: 'sqli', vulnClass: 'SQL Injection', severity: 'error', endpoint: null, message: 'm', steps: [] }],
      rules: [{ id: 'sqli', origin: 'builtin', kind: 'rule', path: 'Builtin/rule/sqli.yaml', content: 'id: sqli' }],
    };
    expect(isPlaygroundContent(c)).toBe(true);
  });

  it('rejects a non-object', () => {
    expect(isPlaygroundContent(null)).toBe(false);
    expect(isPlaygroundContent({ projectId: 1 })).toBe(false);
  });
});
