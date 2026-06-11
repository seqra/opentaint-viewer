// Copy the built template next to the CLI bundle and mark the bundle executable.
// Paths are anchored to the repo root (this file lives in scripts/) so the script
// works regardless of the cwd it is invoked from.
import { copyFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = (...parts) => join(repoRoot, ...parts);

if (!existsSync(r('dist-template', 'index.html'))) {
  throw new Error('dist-template/index.html missing; run `npm run build:template` first');
}
if (!existsSync(r('dist-cli', 'opentaint-viewer.js'))) {
  throw new Error('dist-cli/opentaint-viewer.js missing; run `npm run build:cli` first');
}
mkdirSync(r('dist-cli', 'template'), { recursive: true });
copyFileSync(r('dist-template', 'index.html'), r('dist-cli', 'template', 'index.html'));
chmodSync(r('dist-cli', 'opentaint-viewer.js'), 0o755);
console.log('Packaged CLI: dist-cli/opentaint-viewer.js + dist-cli/template/index.html');
