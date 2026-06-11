// Copy the built template next to the CLI bundle and mark the bundle executable.
import { copyFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';

if (!existsSync('dist-template/index.html')) {
  throw new Error('dist-template/index.html missing; run `npm run build:template` first');
}
if (!existsSync('dist-cli/opentaint-viewer.js')) {
  throw new Error('dist-cli/opentaint-viewer.js missing; run `npm run build:cli` first');
}
mkdirSync('dist-cli/template', { recursive: true });
copyFileSync('dist-template/index.html', 'dist-cli/template/index.html');
chmodSync('dist-cli/opentaint-viewer.js', 0o755);
console.log('Packaged CLI: dist-cli/opentaint-viewer.js + dist-cli/template/index.html');
