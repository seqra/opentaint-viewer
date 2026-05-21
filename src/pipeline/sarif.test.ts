import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { transformSarif, vulnClassForRule } from './sarif';

const log = JSON.parse(readFileSync('fixtures/sample.sarif', 'utf8'));

describe('transformSarif', () => {
  const findings = transformSarif(log);

  it('produces one finding with id, rule, class, endpoint', () => {
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      id: 'sqli-0',
      ruleId: 'sqli',
      vulnClass: 'SQL Injection',
      severity: 'error',
      endpoint: 'GET /users/search',
    });
  });

  it('builds ordered steps with inferred kinds', () => {
    const steps = findings[0].steps;
    expect(steps.map((s) => s.kind)).toEqual(['source', 'propagation', 'sink']);
    expect(steps[0]).toMatchObject({ index: 0, file: 'UserController.java', line: 8, crossesFile: false });
  });

  it('marks the hop that changes file as crossesFile', () => {
    const steps = findings[0].steps;
    expect(steps[2]).toMatchObject({ file: 'UserRepository.java', line: 31, crossesFile: true });
  });
});

describe('vulnClassForRule', () => {
  it('maps known ids and falls back to the id', () => {
    expect(vulnClassForRule('sqli')).toBe('SQL Injection');
    expect(vulnClassForRule('mystery')).toBe('mystery');
  });
});
