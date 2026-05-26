import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode singlefile` inlines everything (JS, CSS, fonts, Monaco + worker) into one
// self-contained, offline index.html. The default build is unchanged (CDN Monaco).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
}));
