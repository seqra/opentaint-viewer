import { describe, it, expect } from 'vitest';
import { bareRuleId, findRuleLine } from './ruleLine';

const YAML = `rules:
   - id: groovy-injection
     pattern: x
   - id: ssti
     pattern: y
   - id: ssti-extra
     pattern: z
`;

describe('bareRuleId', () => {
  it('strips the java.<area>. namespace', () => {
    expect(bareRuleId('java.security.ssti')).toBe('ssti');
    expect(bareRuleId('java.lib.foo-bar')).toBe('foo-bar');
  });

  it('leaves ids without that namespace unchanged', () => {
    expect(bareRuleId('ssti')).toBe('ssti');
    expect(bareRuleId('mystery.thing')).toBe('mystery.thing');
  });
});

describe('findRuleLine', () => {
  it('finds the 1-based line of a rule by its namespaced id', () => {
    expect(findRuleLine(YAML, 'java.security.ssti')).toBe(4);
  });

  it('matches an exact id, not a prefix', () => {
    expect(findRuleLine(YAML, 'java.security.ssti-extra')).toBe(6);
  });

  it('returns null when the rule is not declared in the file', () => {
    expect(findRuleLine(YAML, 'java.security.nope')).toBeNull();
  });
});
