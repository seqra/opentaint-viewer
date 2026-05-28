import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

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
  dir = mkdtempSync(join(tmpdir(), 'gen-'));
  mkdirSync(join(dir, 'proj', 'src'), { recursive: true });
  mkdirSync(join(dir, 'rules'), { recursive: true });
  writeFileSync(join(dir, 'proj', 'src', 'A.java'), 'class A {}');
  writeFileSync(join(dir, 'proj', 'src', 'B.java'), 'class B {}'); // unreferenced -> pruned
  writeFileSync(join(dir, 'rules', 'xss.yaml'), 'id: xss-in-spring-app\n');
  writeFileSync(join(dir, 'rules', 'other.yaml'), 'id: other\n'); // unreferenced -> still kept
  writeFileSync(join(dir, 'report.sarif'), JSON.stringify(sarif));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('gen-content', () => {
  it('generates pruned content with tool info and rule links', () => {
    const out = join(dir, 'content.json');
    execFileSync('npx', ['tsx', 'scripts/gen-content.ts',
      '--sarif', join(dir, 'report.sarif'),
      '--src', join(dir, 'proj', 'src'),
      '--rules', join(dir, 'rules'),
      '--name', 'demo', '--out', out,
    ], { stdio: 'pipe' });
    const c = JSON.parse(readFileSync(out, 'utf8'));

    expect(c.projectId).toBe('demo');
    expect(c.tool).toEqual({ name: 'OpenTaint', semanticVersion: '9.9.9', version: 'analyzer/test' });
    expect(c.files.map((f: { path: string }) => f.path)).toEqual(['src/A.java']); // B.java pruned
    expect(c.rules.map((r: { path: string }) => r.path).sort()).toEqual(['other.yaml', 'xss.yaml']); // all rules
    expect(c.findings[0].ruleFile).toBe('xss.yaml');
    expect(c.findings).toHaveLength(1);
    expect(typeof c.findings[0].defaultFlowIndex).toBe('number');
    expect('scenarios' in c).toBe(false);
  });
});
