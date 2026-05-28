import { describe, it, expect } from 'vitest';
import { isViewerContent } from './content';

describe('isViewerContent', () => {
  it('accepts a minimal valid content object', () => {
    const c = {
      projectId: 'java-spring-demo',
      tool: { name: 'OpenTaint', semanticVersion: '0.3.0' },
      files: [{ path: 'A.java', language: 'java', content: '...' }],
      findings: [{ id: 'f1', ruleId: 'sqli', vulnClass: 'SQL Injection', severity: 'error', endpoint: null, message: 'm', flows: [{ steps: [] }], defaultFlowIndex: 0 }],
      rules: [{ id: 'sqli', origin: 'builtin', kind: 'rule', path: 'Builtin/rule/sqli.yaml', content: 'id: sqli' }],
    };
    expect(isViewerContent(c)).toBe(true);
  });

  it('rejects a finding with no flows or an out-of-range default index', () => {
    const base = { projectId: 'p', files: [], rules: [] };
    const finding = (extra: object) => ({ findings: [{ id: 'f', ruleId: 'r', vulnClass: 'X', severity: 'error', endpoint: null, message: 'm', ...extra }] });
    expect(isViewerContent({ ...base, ...finding({ flows: [], defaultFlowIndex: 0 }) })).toBe(false);
    expect(isViewerContent({ ...base, ...finding({ flows: [{ steps: [] }], defaultFlowIndex: 5 }) })).toBe(false);
    expect(isViewerContent({ ...base, ...finding({ flows: [{ steps: [] }] }) })).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isViewerContent(null)).toBe(false);
    expect(isViewerContent({ projectId: 1 })).toBe(false);
  });

  it('allows omitting tool but rejects a malformed tool', () => {
    const base = { projectId: 'p', files: [], rules: [], findings: [] };
    expect(isViewerContent(base)).toBe(true);
    expect(isViewerContent({ ...base, tool: { semanticVersion: '1.0.0' } })).toBe(false); // no name
    expect(isViewerContent({ ...base, tool: 'x' })).toBe(false);
  });
});
