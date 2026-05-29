import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: { command: 'npm run dev -- --port 5174', url: 'http://localhost:5174', reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://localhost:5174' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /playground\.spec\.ts/ },
    { name: 'mobile',  use: { ...devices['iPhone 14'] },      testMatch: /mobile\.spec\.ts/ },
  ],
});
