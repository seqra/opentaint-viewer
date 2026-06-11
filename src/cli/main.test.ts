// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { CONTENT_PLACEHOLDER } from './render';

const sarif = {
  runs: [{
    originalUriBaseIds: { '%SRCROOT%': { uri: '__SRCROOT__' } },
    tool: { driver: { name: 'OpenTaint', rules: [] } },
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
  dir = mkdtempSync(join(tmpdir(), 'cli-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'rules'), { recursive: true });
  writeFileSync(join(dir, 'src', 'A.java'), 'class A {}');
  writeFileSync(join(dir, 'rules', 'xss.yaml'), 'id: xss-in-spring-app\n');
  // %SRCROOT% points at the temp project root so the source resolves from the SARIF
  sarif.runs[0].originalUriBaseIds['%SRCROOT%'].uri = dir;
  writeFileSync(join(dir, 'report.sarif'), JSON.stringify(sarif));
  writeFileSync(join(dir, 'template.html'),
    `<html><head></head><body><script type="application/json" id="opentaint-content">${CONTENT_PLACEHOLDER}</script></body></html>`);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('opentaint-viewer export', () => {
  it('writes an HTML report with the findings injected, source root taken from the SARIF', () => {
    const out = join(dir, 'report.html');
    execFileSync('npx', ['tsx', 'src/cli/main.ts', 'export',
      '--sarif', join(dir, 'report.sarif'),
      '--rules', join(dir, 'rules'),
      '--out', out,
    ], { stdio: 'pipe', env: { ...process.env, OPENTAINT_VIEWER_TEMPLATE: join(dir, 'template.html') } });

    const html = readFileSync(out, 'utf8');
    expect(html).not.toContain(CONTENT_PLACEHOLDER);
    const json = html.replace(/^[\s\S]*id="opentaint-content">/, '').replace(/<\/script>[\s\S]*$/, '');
    const content = JSON.parse(json);
    expect(content.findings).toHaveLength(1);
    expect(content.files.map((f: { path: string }) => f.path)).toEqual(['src/A.java']);
    expect(content.projectId).toBe(basename(dir)); // name defaults to basename of the SARIF source root
  });
});
