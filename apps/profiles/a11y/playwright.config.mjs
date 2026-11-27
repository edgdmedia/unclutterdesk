import { defineConfig, devices } from '@playwright/test';

/**
 * axe over the same URLs Lighthouse checks. Lighthouse's accessibility score
 * is a weighted roll-up; axe reports each rule, so this fails on any serious
 * or critical violation even when the score would still pass.
 */
const PORT = process.env.A11Y_PORT || '4398';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.a11y\.mjs$/,
  timeout: 60_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});