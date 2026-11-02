import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end test of the client API proxy on a practice custom domain
 * (spec §6.16). The stack (Postgres, API, built app, tenant router under
 * `wrangler dev`) is started by run.sh, locally and in CI; the browser maps
 * the fake custom domain to the local router.
 */
const HOST = process.env.E2E_HOST || 'chente.test';
const PORT = process.env.E2E_ROUTER_PORT || '8787';
const OUTBOUND_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.e2e\.ts$/,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `https://${HOST}:${PORT}`,
    // wrangler dev serves a self-signed certificate.
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    launchOptions: {
      args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`],
    },
    // Where an outbound proxy is configured (some sandboxes), the browser
    // must still reach the local router directly.
    ...(OUTBOUND_PROXY ? { proxy: { server: OUTBOUND_PROXY, bypass: `${HOST},127.0.0.1,localhost` } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
