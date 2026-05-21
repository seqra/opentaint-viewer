import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    // Unit tests live in src as *.test.*; Playwright specs in e2e/*.spec.ts run separately.
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['src/**'], exclude: ['src/**/*.test.*', 'src/main.tsx'] },
  },
});
