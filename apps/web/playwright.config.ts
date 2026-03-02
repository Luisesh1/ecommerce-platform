import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for QA E2E tests.
 * Runs only Chromium headless against http://localhost:3000
 */
export default defineConfig({
  testDir: './e2e',

  timeout: 60_000,
  expect: { timeout: 15_000 },

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1280, height: 720 },
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    ignoreHTTPSErrors: true,
  },

  outputDir: 'test-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
