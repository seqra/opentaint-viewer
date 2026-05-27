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
    const f = findings[0];
    const steps = f.flows[f.defaultFlowIndex].steps;
    expect(steps.map((s) => s.kind)).toEqual(['source', 'propagation', 'sink']);
    expect(steps[0]).toMatchObject({
      index: 0,
      file: 'src/main/java/org/seqra/complexity/UserProfileController.java',
      line: 54,
      crossesFile: false,
    });
  });

  it('captures the precise column span for each step', () => {
    const f = findings[0];
    const steps = f.flows[f.defaultFlowIndex].steps;
    expect(steps[0]).toMatchObject({ startColumn: 9, endLine: 54, endColumn: 41 });
    expect(steps[1]).toMatchObject({ startColumn: 5, endLine: 12, endColumn: 30 });
  });

  it('attaches CWE tags and the full markdown description from the report', () => {
    expect(findings[0].cwe).toEqual(['CWE-79']);
    expect(findings[0].description).toContain('Cross-site scripting (XSS) occurs when');
  });

  it('marks the hop that changes file as crossesFile', () => {
    const f = findings[0];
    const steps = f.flows[f.defaultFlowIndex].steps;
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

describe('transformSarif — code flows', () => {
  const tfl = (uri: string, line: number, text: string) => ({
    location: { physicalLocation: { artifactLocation: { uri }, region: { startLine: line } }, message: { text } },
    kinds: ['taint'],
  });
  const flow = (...locs: ReturnType<typeof tfl>[]) => ({ threadFlows: [{ locations: locs }] });
  const result = (ruleId: string, line: number, codeFlows: ReturnType<typeof flow>[]) => ({
    ruleId,
    level: 'error',
    message: { text: 'm' },
    locations: [{ physicalLocation: { artifactLocation: { uri: 'A.java' }, region: { startLine: line } } }],
    codeFlows,
  });

  it('keeps every code flow as a Flow, in order', () => {
    const log = { runs: [{ results: [result('java.security.ssti', 30, [
      flow(tfl('A.java', 1, 'a'), tfl('A.java', 2, 'b')),
      flow(tfl('A.java', 3, 'c'), tfl('A.java', 4, 'd'), tfl('A.java', 5, 'e')),
    ])] }] };
    const f = transformSarif(log)[0];
    expect(f.flows).toHaveLength(2);
    expect(f.flows[0].steps).toHaveLength(2);
    expect(f.flows[1].steps).toHaveLength(3);
    expect(f.flows[0].steps[0].kind).toBe('source');
  });

  it('defaults to the longest flow when there is no curated override', () => {
    const log = { runs: [{ results: [result('java.security.ssti', 30, [
      flow(tfl('A.java', 1, 'a'), tfl('A.java', 2, 'b')),
      flow(tfl('A.java', 3, 'c'), tfl('A.java', 4, 'd'), tfl('A.java', 5, 'e')),
    ])] }] };
    expect(transformSarif(log)[0].defaultFlowIndex).toBe(1);
  });

  it('the curated override for MessageController.java:96 beats the longest-flow heuristic', () => {
    // Make flow 0 the LONGEST so the heuristic alone would pick it; the override (→ 1)
    // must win, proving the curated table — not just length — drives the default.
    const log = { runs: [{ results: [{
      ruleId: 'java.security.xss-in-spring-app',
      level: 'error',
      message: { text: 'm' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'a/MessageController.java' }, region: { startLine: 96 } } }],
      codeFlows: [
        flow(tfl('a/MessageController.java', 10, 'x'), tfl('a/MessageController.java', 20, 'y'), tfl('a/MessageController.java', 30, 'z')),
        flow(tfl('a/MessageController.java', 33, 'long'), tfl('a/MessageController.java', 96, 'sink')),
      ],
    }] }] };
    expect(transformSarif(log)[0].defaultFlowIndex).toBe(1); // override wins, not the 3-step flow 0
  });

  it('a result with no code flows still yields one empty flow', () => {
    const log = { runs: [{ results: [{ ruleId: 'r', level: 'error', message: { text: 'm' }, locations: [] }] }] };
    const f = transformSarif(log)[0];
    expect(f.flows).toHaveLength(1);
    expect(f.flows[0].steps).toEqual([]);
    expect(f.defaultFlowIndex).toBe(0);
  });

});
