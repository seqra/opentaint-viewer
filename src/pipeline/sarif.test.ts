import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { transformSarif, vulnClassForRule } from './sarif';

const log = JSON.parse(readFileSync('fixtures/sample.sarif', 'utf8'));

describe('transformSarif', () => {
  const findings = transformSarif(log);

  it('produces one finding with id, rule, class, severity', () => {
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      id: 'java.security.xss-in-spring-app-0',
      ruleId: 'java.security.xss-in-spring-app',
      vulnClass: 'XSS',
      severity: 'error',
    });
  });

  it('has no endpoint (opentaint SARIF omits it) and a primary location', () => {
    expect(findings[0].endpoint).toBeNull();
    expect(findings[0].location).toBe('UserProfileController.java:58');
    expect(findings[0].file).toBe('src/main/java/org/seqra/complexity/UserProfileController.java');
    expect(findings[0].ruleFile).toBeNull();
  });

  it('builds ordered steps with positionally-inferred kinds (real kinds are ["taint"])', () => {
    const steps = findings[0].steps;
    expect(steps.map((s) => s.kind)).toEqual(['source', 'propagation', 'sink']);
    expect(steps[0]).toMatchObject({
      index: 0,
      file: 'src/main/java/org/seqra/complexity/UserProfileController.java',
      line: 54,
      crossesFile: false,
    });
  });

  it('captures the precise column span for each step', () => {
    expect(findings[0].steps[0]).toMatchObject({ startColumn: 9, endLine: 54, endColumn: 41 });
    expect(findings[0].steps[1]).toMatchObject({ startColumn: 5, endLine: 12, endColumn: 30 });
  });

  it('marks the hop that changes file as crossesFile', () => {
    const steps = findings[0].steps;
    expect(steps[1]).toMatchObject({ file: 'src/main/java/org/seqra/complexity/HtmlPageBuilder.java', crossesFile: true });
    expect(steps[2].crossesFile).toBe(true);
  });
});

describe('vulnClassForRule', () => {
  it('maps namespaced opentaint rule ids to short labels', () => {
    expect(vulnClassForRule('java.security.xss-in-spring-app')).toBe('XSS');
    expect(vulnClassForRule('java.security.ssti')).toBe('Template Injection');
    expect(vulnClassForRule('java.security.ssrf')).toBe('SSRF');
  });

  it('prettifies the last segment for unknown rules', () => {
    expect(vulnClassForRule('java.security.open-redirect')).toBe('Open Redirect');
    expect(vulnClassForRule('mystery.thing')).toBe('Thing');
  });
});
