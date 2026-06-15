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
  // custom rules: a brand-new rule, plus one whose id collides with builtin xss
  mkdirSync(join(dir, 'custom'), { recursive: true });
  writeFileSync(join(dir, 'custom', 'mine.yaml'), 'id: my-custom-rule\n');
  writeFileSync(join(dir, 'custom', 'override-xss.yaml'), 'id: xss-in-spring-app\n');
  // a custom rule sharing the SAME relative path as a builtin one
  mkdirSync(join(dir, 'custom-samepath'), { recursive: true });
  writeFileSync(join(dir, 'custom-samepath', 'xss.yaml'), 'id: xss-in-spring-app\n');
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

const sarifCustomId = {
  runs: [{
    tool: { driver: { name: 'OpenTaint', rules: [] } },
    results: [{
      ruleId: 'my-custom-rule', level: 'error', message: { text: 'm' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 1 } } }],
      codeFlows: [{ threadFlows: [{ locations: [
        { location: { physicalLocation: { artifactLocation: { uri: 'src/A.java' }, region: { startLine: 1 } }, message: { text: 'source' } }, kinds: ['taint'] },
      ] }] }],
    }],
  }],
};

describe('generateContent — custom rules', () => {
  it('loads custom rules tagged origin "custom" and resolves a finding to one', () => {
    const c = generateContent({
      sarifLog: sarifCustomId,
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),
      customRulesDir: join(dir, 'custom'),
      projectId: 'demo',
    });
    const custom = c.rules.filter((r) => r.origin === 'custom').map((r) => r.path).sort();
    expect(custom).toEqual(['mine.yaml', 'override-xss.yaml']);
    expect(c.rules.find((r) => r.path === 'mine.yaml')?.origin).toBe('custom');
    expect(c.findings[0].ruleFile).toBe('mine.yaml');
  });

  it('lets a custom rule win on an id collision with builtin', () => {
    const c = generateContent({
      sarifLog: sarif, // top-level fixture: ruleId java.security.xss-in-spring-app
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),       // builtin xss.yaml has id: xss-in-spring-app
      customRulesDir: join(dir, 'custom'), // override-xss.yaml has the same id
      projectId: 'demo',
    });
    expect(c.findings[0].ruleFile).toBe('override-xss.yaml');
    // both files are present because their relative paths differ
    expect(c.rules.some((r) => r.path === 'xss.yaml' && r.origin === 'builtin')).toBe(true);
    expect(c.rules.some((r) => r.path === 'override-xss.yaml' && r.origin === 'custom')).toBe(true);
  });

  it('replaces a builtin rule when a custom rule shares its relative path', () => {
    const c = generateContent({
      sarifLog: sarif,
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),
      customRulesDir: join(dir, 'custom-samepath'), // also contains xss.yaml
      projectId: 'demo',
    });
    const xss = c.rules.filter((r) => r.path === 'xss.yaml');
    expect(xss).toHaveLength(1);
    expect(xss[0].origin).toBe('custom');
    expect(c.findings[0].ruleFile).toBe('xss.yaml');
  });

  it('omits custom rules entirely when customRulesDir is not given', () => {
    const c = generateContent({
      sarifLog: sarif,
      srcDir: join(dir, 'proj', 'src'),
      root: join(dir, 'proj'),
      rulesDir: join(dir, 'rules'),
      projectId: 'demo',
    });
    expect(c.rules.every((r) => r.origin === 'builtin')).toBe(true);
    expect(c.findings[0].ruleFile).toBe('xss.yaml');
  });
});
