import { describe, it, expect } from 'vitest';
import { ruleRefs, ruleRefTarget, RULE_REF_SCHEME } from './ruleRefs';
import content from '../content/java-spring-demo.json';

describe('ruleRefs', () => {
  it('parses a `rule:` reference with a fragment into path + anchor and an exact span', () => {
    const line = '         - rule: java/lib/generic/servlet-untrusted-data-source.yaml#java-servlet-untrusted-data-source';
    const yaml = `rules:\n${line}`;
    const refs = ruleRefs(yaml);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      line: 2,
      path: 'java/lib/generic/servlet-untrusted-data-source.yaml',
      anchor: 'java-servlet-untrusted-data-source',
    });
    // The column span must cover exactly the reference token (1-based, end exclusive).
    expect(line.slice(refs[0].startColumn - 1, refs[0].endColumn - 1)).toBe(
      'java/lib/generic/servlet-untrusted-data-source.yaml#java-servlet-untrusted-data-source',
    );
  });

  it('handles a reference without a fragment (anchor null)', () => {
    expect(ruleRefs('  - rule: java/lib/x.yaml')[0]).toMatchObject({
      line: 1,
      path: 'java/lib/x.yaml',
      anchor: null,
    });
  });

  it('ignores lines that do not declare a rule reference', () => {
    expect(ruleRefs('id: ssti\nmessage: a config.yaml mentioned in prose is not a ref')).toEqual([]);
  });

  it('locates references in real rule content with spans that cover the exact token', () => {
    const rule = content.rules.find((r) => r.id === 'java/security/code-injection.yaml')!;
    const refs = ruleRefs(rule.content);
    expect(refs.length).toBeGreaterThan(0);
    const lines = rule.content.split('\n');
    for (const r of refs) {
      const token = r.anchor ? `${r.path}#${r.anchor}` : r.path;
      expect(lines[r.line - 1].slice(r.startColumn - 1, r.endColumn - 1)).toBe(token);
      // Every referenced file is bundled, so the link cannot dangle.
      expect(content.rules.some((x) => x.id === r.path)).toBe(true);
    }
  });
});

describe('ruleRefTarget', () => {
  it('decodes a rule-ref link URI into the file path and rule anchor', () => {
    expect(ruleRefTarget(RULE_REF_SCHEME, '/java/lib/x.yaml', 'spring-untrusted-data-source')).toEqual({
      path: 'java/lib/x.yaml',
      anchor: 'spring-untrusted-data-source',
    });
  });

  it('treats an empty fragment as no anchor', () => {
    expect(ruleRefTarget(RULE_REF_SCHEME, 'java/lib/x.yaml', '')).toEqual({ path: 'java/lib/x.yaml', anchor: null });
  });

  it('ignores other URI schemes (e.g. plain http links the editor also detects)', () => {
    expect(ruleRefTarget('https', '//portswigger.net/x', '')).toBeNull();
  });
});
