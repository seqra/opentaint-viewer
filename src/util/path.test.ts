import { describe, it, expect } from 'vitest';
import { basename, dirname, lastSegments, breadcrumb } from './path';

describe('path helpers', () => {
  it('basename returns the last segment', () => {
    expect(basename('a/b/c.java')).toBe('c.java');
    expect(basename('only.yaml')).toBe('only.yaml');
  });

  it('dirname returns everything before the last segment', () => {
    expect(dirname('a/b/c.java')).toBe('a/b');
    expect(dirname('top.yaml')).toBe('');
  });

  it('lastSegments keeps the trailing n segments', () => {
    expect(lastSegments('a/b/c.java', 2)).toBe('b/c.java');
    expect(lastSegments('a/b/c.java', 1)).toBe('c.java');
  });

  it('breadcrumb joins segments for display', () => {
    expect(breadcrumb('java/security/xss.yaml')).toBe('java › security › xss.yaml');
  });
});
