// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { loadTemplate } from './template';

const fakeCli = pathToFileURL('/opt/opentaint/bin/opentaint-viewer.js').href;

afterEach(() => { delete process.env.OPENTAINT_VIEWER_TEMPLATE; });

describe('loadTemplate', () => {
  it('reads the file named by OPENTAINT_VIEWER_TEMPLATE', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tpl-'));
    try {
      const file = join(dir, 'index.html');
      writeFileSync(file, '<html>tpl</html>');
      process.env.OPENTAINT_VIEWER_TEMPLATE = file;
      expect(loadTemplate(fakeCli)).toBe('<html>tpl</html>');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails loudly when OPENTAINT_VIEWER_TEMPLATE is set but missing', () => {
    process.env.OPENTAINT_VIEWER_TEMPLATE = '/no/such/template.html';
    expect(() => loadTemplate(fakeCli)).toThrow(/does not exist/);
  });

  it('discovers ./template/index.html next to the CLI', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tpl-'));
    try {
      mkdirSync(join(dir, 'template'), { recursive: true });
      writeFileSync(join(dir, 'template', 'index.html'), '<html>bundle</html>');
      const cliUrl = pathToFileURL(join(dir, 'opentaint-viewer.js')).href;
      expect(loadTemplate(cliUrl)).toBe('<html>bundle</html>');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws a build hint when no template can be found', () => {
    const cliUrl = pathToFileURL('/opt/opentaint-nonexistent-xyz/bin/opentaint-viewer.js').href;
    expect(() => loadTemplate(cliUrl)).toThrow(/build:template/);
  });
});
