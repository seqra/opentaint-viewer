import { describe, it, expect } from 'vitest';
import content from './java-spring-demo.json';
import { isPlaygroundContent } from '../types/content';
import { findRuleLine } from '../rules/ruleLine';

describe('committed content', () => {
  it('matches the data contract', () => {
    expect(isPlaygroundContent(content)).toBe(true);
  });

  it('every scenario references an existing finding and file', () => {
    const findingIds = new Set(content.findings.map((f) => f.id));
    const filePaths = new Set(content.files.map((f) => f.path));
    for (const s of content.scenarios) {
      expect(findingIds.has(s.defaultFindingId)).toBe(true);
      expect(filePaths.has(s.startFile)).toBe(true);
    }
  });

  it('every taint step references an existing file', () => {
    const filePaths = new Set(content.files.map((f) => f.path));
    for (const f of content.findings) for (const s of f.steps) {
      expect(filePaths.has(s.file)).toBe(true);
    }
  });

  it("every finding's ruleId is locatable in its linked rule file", () => {
    const ruleById = new Map(content.rules.map((r) => [r.id, r]));
    for (const f of content.findings) {
      if (!f.ruleFile) continue;
      const rule = ruleById.get(f.ruleFile);
      expect(rule, `missing rule file ${f.ruleFile}`).toBeDefined();
      expect(findRuleLine(rule!.content, f.ruleId), `cannot anchor ${f.ruleId} in ${f.ruleFile}`).not.toBeNull();
    }
  });
});
