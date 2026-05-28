import { describe, it, expect } from 'vitest';
import content from '../../data/content.json';
import { isViewerContent } from '../types/content';
import { findRuleLine } from '../rules/ruleLine';

describe('committed content', () => {
  it('matches the data contract', () => {
    expect(isViewerContent(content)).toBe(true);
  });

  it('every taint step references an existing file', () => {
    const filePaths = new Set(content.files.map((f) => f.path));
    for (const f of content.findings) for (const flow of f.flows) for (const s of flow.steps) {
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
