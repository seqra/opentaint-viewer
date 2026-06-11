// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { loadTemplate } from './template';

const cliUrl = pathToFileURL('/opt/opentaint/bin/opentaint-viewer.js').href;

afterEach(() => { delete process.env.OPENTAINT_VIEWER_TEMPLATE; });

describe('loadTemplate', () => {
  it('reads the file named by OPENTAINT_VIEWER_TEMPLATE', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tpl-'));
    try {
      const file = join(dir, 'index.html');
      writeFileSync(file, '<html>tpl</html>');
      process.env.OPENTAINT_VIEWER_TEMPLATE = file;
      expect(loadTemplate(cliUrl)).toBe('<html>tpl</html>');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws a build hint when no template can be found', () => {
    process.env.OPENTAINT_VIEWER_TEMPLATE = '/no/such/template.html';
    expect(() => loadTemplate(cliUrl)).toThrow(/build:template/);
  });
});
