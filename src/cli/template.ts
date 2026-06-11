import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Candidate template locations, in priority order, given the CLI's own URL. */
function candidates(cliUrl: string): string[] {
  const list: string[] = [];
  if (process.env.OPENTAINT_VIEWER_TEMPLATE) list.push(process.env.OPENTAINT_VIEWER_TEMPLATE);
  // Bundled install / build: dist-cli/opentaint-viewer.js + dist-cli/template/index.html
  list.push(fileURLToPath(new URL('./template/index.html', cliUrl)));
  // Dev via tsx from src/cli/, or the bundle run from dist-cli/, pointing at the Vite output
  list.push(fileURLToPath(new URL('../../dist-template/index.html', cliUrl)));
  list.push(fileURLToPath(new URL('../dist-template/index.html', cliUrl)));
  return list;
}

export function loadTemplate(cliUrl: string): string {
  for (const path of candidates(cliUrl)) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error('viewer template not found; build it first with `npm run build:template`');
}
