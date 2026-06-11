import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const CONTENT_PLACEHOLDER = '__OPENTAINT_CONTENT__';
const STUB = fileURLToPath(new URL('./src/content/bundledContent.stub.ts', import.meta.url));

/** In `template` mode, drop in the empty content <script> the CLI fills per report. */
function injectContentPlaceholder(): Plugin {
  return {
    name: 'opentaint-content-placeholder',
    transformIndexHtml(html) {
      return html.replace(
        '</body>',
        `<script type="application/json" id="opentaint-content">${CONTENT_PLACEHOLDER}</script></body>`,
      );
    },
  };
}

/** In `template` mode, swap the demo content import for the null stub so the
 * ~0.5 MB demo is not shipped inside the CLI template. */
function stubBundledContent(): Plugin {
  return {
    name: 'opentaint-stub-bundled-content',
    enforce: 'pre',
    resolveId(source) {
      if (source === './bundledContent' || source.endsWith('/content/bundledContent')) {
        return STUB;
      }
      return null;
    },
  };
}

// `--mode singlefile` and `--mode template` both inline everything into one HTML file.
// `template` additionally stubs the demo content and injects the CLI's content placeholder.
export default defineConfig(({ mode }) => {
  const singlefile = mode === 'singlefile' || mode === 'template';
  return {
    plugins: [
      react(),
      ...(singlefile ? [viteSingleFile()] : []),
      ...(mode === 'template' ? [stubBundledContent(), injectContentPlaceholder()] : []),
    ],
  };
});
