import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Auto-discovery template locations, in priority order, relative to the CLI's own URL. */
function candidates(cliUrl: string): string[] {
  return [
    // Bundled install / build: dist-cli/opentaint-viewer.js + dist-cli/template/index.html
    fileURLToPath(new URL('./template/index.html', cliUrl)),
    // Dev via tsx from src/cli/, or the bundle run from dist-cli/, pointing at the Vite output
    fileURLToPath(new URL('../../dist-template/index.html', cliUrl)),
    fileURLToPath(new URL('../dist-template/index.html', cliUrl)),
  ];
}

export function loadTemplate(cliUrl: string): string {
  // An explicit override is a user intent: if set but missing, fail loudly rather than
  // silently falling back to a discovered template.
  const envPath = process.env.OPENTAINT_VIEWER_TEMPLATE;
  if (envPath !== undefined) {
    if (!existsSync(envPath)) {
      throw new Error(`OPENTAINT_VIEWER_TEMPLATE=${envPath} does not exist`);
    }
    return readFileSync(envPath, 'utf8');
  }
  const searched = candidates(cliUrl);
  for (const path of searched) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error(
    'viewer template not found; build it first with `npm run build:template`\n' +
      `searched:\n${searched.map((p) => `  ${p}`).join('\n')}`,
  );
}
