import { describe, it, expect } from 'vitest';
import { loadContent, findingById, fileByPath, rulesByOrigin } from './loadContent';

describe('content selectors', () => {
  const c = loadContent();

  it('loads the committed content', () => {
    expect(c.projectId).toBe('java-spring-demo');
    expect(c.findings.length).toBeGreaterThan(0);
    expect(c.files.length).toBeGreaterThan(0);
  });

  it('findingById returns the matching finding or undefined', () => {
    const f0 = c.findings[0];
    expect(findingById(c, f0.id)?.vulnClass).toBe(f0.vulnClass);
    expect(findingById(c, 'nope-does-not-exist')).toBeUndefined();
  });

  it('fileByPath returns the matching file', () => {
    const file0 = c.files[0];
    expect(fileByPath(c, file0.path)?.language).toBe(file0.language);
    expect(fileByPath(c, 'no/such/file')).toBeUndefined();
  });

  it('rulesByOrigin groups builtin vs custom', () => {
    const grouped = rulesByOrigin(c);
    expect(grouped.builtin.length).toBeGreaterThan(0);
    expect(grouped.custom).toEqual([]);
  });
});

describe('loadContent injection', () => {
  it('prefers injected #opentaint-content JSON over the bundled demo', () => {
    const injected = {
      projectId: 'injected-proj', files: [], rules: [],
      // minimal shape — isViewerContent only checks flows/defaultFlowIndex, not full Finding fields
      findings: [{ flows: [{ steps: [] }], defaultFlowIndex: 0 }],
    };
    const el = document.createElement('script');
    el.type = 'application/json';
    el.id = 'opentaint-content';
    el.textContent = JSON.stringify(injected);
    document.body.appendChild(el);
    try {
      expect(loadContent().projectId).toBe('injected-proj');
    } finally {
      el.remove();
    }
  });
});
