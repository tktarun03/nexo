import { defineConfig, devices } from '@playwright/test';

// PW_CHROMIUM lets a sandbox point at a preinstalled Chromium; CI uses Playwright's own.
const executablePath = process.env.PW_CHROMIUM || undefined;
const iphone = { ...devices['iPhone 13'], browserName: 'chromium', launchOptions: { executablePath } };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
    serviceWorkers: 'block', // tests must not depend on a cached build
  },
  projects: [
    { name: 'iphone-se', use: { ...iphone, viewport: { width: 375, height: 667 } } },
    { name: 'iphone-13', use: { ...iphone, viewport: { width: 390, height: 844 } } },
    { name: 'iphone-pro-max', use: { ...iphone, viewport: { width: 430, height: 932 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
