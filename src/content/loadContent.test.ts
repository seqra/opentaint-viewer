import { describe, it, expect } from 'vitest';
import { loadContent, findingById, fileByPath, rulesByOrigin } from './loadContent';

describe('content selectors', () => {
  const c = loadContent();

  it('loads the committed content', () => {
    expect(c.projectId).toBe('java-spring-demo');
    expect(c.findings.length).toBeGreaterThan(0);
  });

  it('findingById returns the matching finding or undefined', () => {
    expect(findingById(c, 'sqli-0')?.vulnClass).toBe('SQL Injection');
    expect(findingById(c, 'nope')).toBeUndefined();
  });

  it('fileByPath returns the matching file', () => {
    expect(fileByPath(c, 'UserController.java')?.language).toBe('java');
  });

  it('rulesByOrigin groups builtin vs custom', () => {
    const grouped = rulesByOrigin(c);
    expect(grouped.builtin.length).toBeGreaterThan(0);
    expect(grouped.custom).toEqual([]);
  });
});
