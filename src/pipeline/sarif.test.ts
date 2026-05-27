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

  it('attaches CWE tags and the full markdown description from the report', () => {
    expect(findings[0].cwe).toEqual(['CWE-79']);
    expect(findings[0].description).toContain('Cross-site scripting (XSS) occurs when');
  });

  it('marks the hop that changes file as crossesFile', () => {
    const steps = findings[0].steps;
    expect(steps[1]).toMatchObject({ file: 'src/main/java/org/seqra/complexity/HtmlPageBuilder.java', crossesFile: true });
    expect(steps[2].crossesFile).toBe(true);
  });
});

describe('transformSarif codeFlow selection', () => {
  // opentaint emits several codeFlows per result for stored taint: an abbreviated flow
  // that starts where the value is read back, and the full flow from the original source
  // through storage. We want the full one, regardless of codeFlow order.
  const mk = (uri: string, line: number, text: string) => ({
    location: { physicalLocation: { artifactLocation: { uri }, region: { startLine: line } }, message: { text } },
    kinds: ['taint'],
  });

  it('picks the most complete threadFlow even when a shorter codeFlow comes first', () => {
    const log = {
      runs: [
        {
          results: [
            {
              ruleId: 'java.security.xss-in-spring-app',
              level: 'error',
              locations: [{ physicalLocation: { artifactLocation: { uri: 'A.java' }, region: { startLine: 96 } } }],
              codeFlows: [
                // Abbreviated read-half flow (listed first, as opentaint does).
                { threadFlows: [{ locations: [mk('A.java', 87, 'read back'), mk('A.java', 96, 'sink')] }] },
                // Full stored flow: original source -> store -> read back -> sink.
                {
                  threadFlows: [
                    {
                      locations: [
                        mk('A.java', 33, 'request untrusted'),
                        mk('B.java', 31, 'saved to repository'),
                        mk('A.java', 87, 'read back'),
                        mk('A.java', 96, 'sink'),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const [finding] = transformSarif(log);
    expect(finding.steps).toHaveLength(4);
    expect(finding.steps[0]).toMatchObject({ kind: 'source', line: 33, label: 'request untrusted' });
    expect(finding.steps.at(-1)).toMatchObject({ kind: 'sink', line: 96 });
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
