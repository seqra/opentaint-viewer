import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import './theme.css';

async function boot() {
  // The offline single-file build bundles Monaco locally; the hosted build loads it from
  // the CDN. MODE is replaced at build time, so this branch is tree-shaken out of the
  // hosted bundle entirely — Monaco is only pulled in for `vite build --mode singlefile`.
  if (import.meta.env.MODE === 'singlefile') {
    await import('./monaco-setup');
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
