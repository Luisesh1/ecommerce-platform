import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for the ecommerce web app.
 *
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  /** Directory where the spec files live */
  testDir: './',

  /** Give each test a generous timeout (network-heavy operations) */
  timeout: 60_000,

  /** Global expect timeout */
  expect: {
    timeout: 15_000,
  },

  /**
   * Run all spec files in parallel by default.
   * On CI we run serially to avoid port / resource conflicts.
   */
  fullyParallel: !process.env.CI,

  /** Fail the test run immediately on any test.only() committed to CI */
  forbidOnly: !!process.env.CI,

  /** Retry failed tests: 2 retries on CI, 0 locally */
  retries: process.env.CI ? 2 : 0,

  /** Parallelism: single worker on CI, auto on local */
  workers: process.env.CI ? 1 : undefined,

  /** Built-in HTML reporter (view with: pnpm playwright show-report) */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ...(process.env.CI ? ([['github']] as const) : []),
  ],

  /** Settings shared across all projects */
  use: {
    /** Base URL — override via PLAYWRIGHT_BASE_URL env var */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    /** Capture traces on first retry so failures are debuggable */
    trace: 'on-first-retry',

    /** Take screenshots only when a test fails */
    screenshot: 'only-on-failure',

    /** Record video only on retry (avoids large artifacts on green runs) */
    video: 'on-first-retry',

    /** Reasonable viewport */
    viewport: { width: 1280, height: 720 },

    /** Accept browser language as Spanish (Mexico) to match store locale */
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',

    /** Trust self-signed TLS certificates in dev */
    ignoreHTTPSErrors: true,

    /** Extra HTTP headers added to every request */
    extraHTTPHeaders: {
      'X-E2E-Test': 'true',
    },
  },

  /** Output directory for artifacts (traces, screenshots, videos) */
  outputDir: 'test-results',

  // ---------------------------------------------------------------------------
  // Browser projects
  // ---------------------------------------------------------------------------
  projects: [
    // -- Desktop browsers --
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // -- Mobile browsers --
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },

    // -- Admin-only tests (chromium, wider viewport) --
    {
      name: 'admin-chromium',
      testMatch: /admin-features\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  // ---------------------------------------------------------------------------
  // Dev web server — only started when NOT on CI
  // ---------------------------------------------------------------------------
  webServer: process.env.CI
    ? undefined
    : {
        /**
         * Starts the Next.js dev server from the apps/web directory.
         * The cwd below is relative to the playwright.config.ts file,
         * so '..' points at apps/web.
         */
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        cwd: '.',
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
