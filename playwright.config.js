import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  testMatch: '**/*.spec.js',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5197',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'touch', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [{
    command: 'node browser-tests/start-site.mjs',
    url: 'http://127.0.0.1:5197',
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      NALANA_API_BASE: 'http://127.0.0.1:59999',
      VITE_NALANA_API_BASE: 'http://127.0.0.1:59999',
      NALANA_FUNNEL_ENABLED: 'false',
      NALANA_ACQUISITION_RELAY: 'false',
      NALANA_ACQUISITION_PAIRING: 'false',
      PUBLIC_NALANA_FUNNEL_ENABLED: 'false',
      PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED: 'true',
      PUBLIC_CAMPAIGN_TOTALS_ENABLED: process.env.CAMPAIGN_BROWSER_TEST === 'true' ? 'true' : 'false',
      PUBLIC_CAMPAIGN_ALLOWED_LABELS: '[{"source":"facebook","medium":"paid_social","campaign":"Autumn Creators"}]',
      PYTHON_DOTENV_DISABLED: '1',
    },
  }, {
    command: 'node node_modules/vite/bin/vite.js --config browser-tests/fixtures/vite.config.js',
    url: 'http://127.0.0.1:5198',
    timeout: 30000,
    reuseExistingServer: false,
  }],
});
