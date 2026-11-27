import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import worker, { type Env } from './index';
import { redirectTarget } from './redirects';

/**
 * §4.1b "Redirects after the move": every old address keeps working for at
 * least 12 months by sending people, and search engines, to its new one.
 */
const ENV: Env = {
  OLD_ROOT: 'unclutterdesk.com',
  NEW_PRACTICE_ROOT: 'therapysts.app',
  APP_URL: 'https://therapysts.app',
  PROFILES_URL: 'https://therapysts.com',
  MARKETING_URL: 'https://unclutterdesk.com',
};
const to = (url: string) => redirectTarget(new URL(url), ENV);

describe('where each old address goes', () => {
  it('sends a practice subdomain to the same practice on .app, path and query kept', () => {
    expect(to('https://dr-smith.unclutterdesk.com/book?step=time')).toBe('https://dr-smith.therapysts.app/book?step=time');
    expect(to('https://dr-smith.unclutterdesk.com/')).toBe('https://dr-smith.therapysts.app/');
  });

  it('sends the app to the bare .app domain', () => {
    expect(to('https://app.unclutterdesk.com/dashboard/clients?tab=active')).toBe('https://therapysts.app/dashboard/clients?tab=active');
  });

  it('sends the old admin host to the admin console on the app', () => {
    expect(to('https://admin.unclutterdesk.com/')).toBe('https://therapysts.app/admin');
    expect(to('https://admin.unclutterdesk.com/admin/tenants')).toBe('https://therapysts.app/admin/tenants');
  });

  it('sends old profile links to therapysts.com', () => {
    expect(to('https://profiles.unclutterdesk.com/ada-obi')).toBe('https://therapysts.com/ada-obi');
  });

  it('keeps www on the marketing site, which has not moved yet', () => {
    expect(to('https://www.unclutterdesk.com/pricing')).toBe('https://unclutterdesk.com/pricing');
  });

  it('never redirects the API, other services, or hosts it does not issue', () => {
    for (const url of ['https://api.unclutterdesk.com/v1/health', 'https://a.b.unclutterdesk.com/', 'https://unclutterdesk.com/', 'https://evil-unclutterdesk.com/', 'https://chente.com/']) {
      expect(to(url)).toBeNull();
    }
  });

  it('is case-insensitive about the host', () => {
    expect(to('https://DR-Smith.UnclutterDesk.com/')).toBe('https://dr-smith.therapysts.app/');
  });
});

describe('the Worker', () => {
  const call = (url: string, init: RequestInit = {}) => worker.fetch(new Request(url, init), ENV);

  it('answers a page view with a permanent 301', async () => {
    const res = await call('https://dr-smith.unclutterdesk.com/book');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://dr-smith.therapysts.app/book');
  });

  it('keeps the method and body of anything else with a 308', async () => {
    const res = await call('https://dr-smith.unclutterdesk.com/anything', { method: 'POST', body: 'x' });
    expect(res.status).toBe(308);
  });

  it('answers 404 for what it never redirects, rather than guessing', async () => {
    const res = await call('https://api.unclutterdesk.com/v1/health');
    expect(res.status).toBe(404);
  });
});

describe('wrangler.jsonc', () => {
  const config = readFileSync(resolve(__dirname, '../wrangler.jsonc'), 'utf8')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n');

  it('takes the old practice subdomains and keeps workers.dev off', () => {
    expect(config).toMatch(/"pattern"\s*:\s*"\*\.unclutterdesk\.com\/\*"/);
    expect(config).toMatch(/"workers_dev"\s*:\s*false/);
  });
});
