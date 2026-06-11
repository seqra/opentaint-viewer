// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateContent } from './generateContent';

const sarif = {
  runs: [{
    tool: { driver: { name: 'OpenTaint', semanticVersion: '9.9.9', version: 'analyzer/test', rules: [] } },
    results: [{
      ruleId: 'java.security.xss-in-spring-app', level: 'error', message: { text: 'm' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 2 } } }],
      codeFlows: [{ threadFlows: [{ locations: [
        { location: { physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 1 } }, message: { text: 'source' } }, kinds: ['taint'] },
        { location: { physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 2 } }, message: { text: 'sink' } }, kinds: ['taint'] },
      ] }] }],
    }],
  }],
};

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gencontent-'));
  mkdirSync(join(dir, 'proj', 'src'), { recursive: true });
  mkdirSync(join(dir, 'rules'), { recursive: true });
  writeFileSync(join(dir, 'proj', 'src', 'A.java'), 'class A {}');
  writeFileSync(join(dir, 'proj', 'src', 'B.java'), 'class B {}');
  writeFileSync(join(dir, 'rules', 'xss.yaml'), 'id: xss-in-spring-app\n');
  writeFileSync(join(dir, 'rules', 'other.yaml'), 'id: other\n');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('generateContent', () => {
  it('prunes files to those referenced, keeps all rules, links rule files', () => {
    const c = generateContent({
      sarifLog: sarif,
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),
      projectId: 'demo',
    });
    expect(c.projectId).toBe('demo');
    expect(c.tool).toEqual({ name: 'OpenTaint', semanticVersion: '9.9.9', version: 'analyzer/test' });
    expect(c.files.map((f) => f.path)).toEqual(['src/A.java']);
    expect(c.rules.map((r) => r.path).sort()).toEqual(['other.yaml', 'xss.yaml']);
    expect(c.findings[0].ruleFile).toBe('xss.yaml');
    expect(c.findings).toHaveLength(1);
    expect(typeof c.findings[0].defaultFlowIndex).toBe('number');
    expect('scenarios' in c).toBe(false);
  });

  it('rejects a non-object SARIF log', () => {
    expect(() => generateContent({
      sarifLog: 'not json', srcDir: dir, root: dir, rulesDir: join(dir, 'rules'), projectId: 'x',
    })).toThrow(/JSON object/);
  });
});
