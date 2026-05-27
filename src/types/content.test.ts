import { describe, it, expect } from 'vitest';
import { isViewerContent } from './content';

describe('isViewerContent', () => {
  it('accepts a minimal valid content object', () => {
    const c = {
      projectId: 'java-spring-demo',
      scenarios: [{ id: 's1', title: 'SQLi', blurb: 'b', startFile: 'A.java', defaultFindingId: 'f1' }],
      files: [{ path: 'A.java', language: 'java', content: '...' }],
      findings: [{ id: 'f1', ruleId: 'sqli', vulnClass: 'SQL Injection', severity: 'error', endpoint: null, message: 'm', steps: [] }],
      rules: [{ id: 'sqli', origin: 'builtin', kind: 'rule', path: 'Builtin/rule/sqli.yaml', content: 'id: sqli' }],
    };
    expect(isViewerContent(c)).toBe(true);
  });

  it('rejects a non-object', () => {
    expect(isViewerContent(null)).toBe(false);
    expect(isViewerContent({ projectId: 1 })).toBe(false);
  });
});
