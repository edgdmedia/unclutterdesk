import { describe, expect, it } from 'vitest';
import { APP_BASE_URL, getBookingUrl, practiceBookingUrl } from '../apiClient';

describe('getBookingUrl', () => {
  it('builds a tenant subdomain booking URL on localhost in dev', () => {
    const port = window.location.port;
    expect(getBookingUrl('dr-smith')).toBe(`http://dr-smith.localhost${port ? `:${port}` : ''}`);
  });

  it('falls back to the app base URL when no slug is provided', () => {
    expect(getBookingUrl('')).toBe(APP_BASE_URL);
  });
});

describe('practiceBookingUrl', () => {
  const port = window.location.port;
  const subdomain = `http://calm-harbor.localhost${port ? `:${port}` : ''}`;

  // Staff use app.unclutterdesk.com, whose host carries no practice slug.
  it('builds from the session slug, not the page host', () => {
    expect(practiceBookingUrl('calm-harbor')).toBe(subdomain);
  });

  it('never produces an address with an empty subdomain', () => {
    expect(practiceBookingUrl('')).not.toMatch(/\/\/\./);
    expect(practiceBookingUrl(null)).not.toMatch(/\/\/\./);
  });

  it('uses a custom domain once it is verified', () => {
    expect(practiceBookingUrl('calm-harbor', 'book.calmharbor.ng', 'ACTIVE')).toBe('https://book.calmharbor.ng');
  });

  // A pending domain does not reach the app yet; sharing it sends clients nowhere.
  it.each(['PENDING', 'FAILED', null])('ignores a custom domain that is %s', (status) => {
    expect(practiceBookingUrl('calm-harbor', 'book.calmharbor.ng', status)).toBe(subdomain);
  });
});

describe('the API base on a practice custom domain (spec §6.16)', () => {
  // Imported lazily so the module-level API_BASE under test is the jsdom one.
  const load = () => import('../apiClient');

  it.each(['chente.com', 'consult.unclutter.com.ng', 'book.calmharbor.ng'])('%s calls its own /api', async (host) => {
    const { isPracticeCustomDomain, resolveApiBase } = await load();
    expect(isPracticeCustomDomain(host)).toBe(true);
    expect(resolveApiBase(host, `https://${host}`)).toBe(`https://${host}/api`);
  });

  it.each([
    'dr-smith.unclutterdesk.com',
    'app.unclutterdesk.com',
    'unclutterdesk.com',
    'localhost',
    'dr-smith.localhost',
    '127.0.0.1',
    'app-unclutterdesk.pages.dev',
    'abc123.app-unclutterdesk.pages.dev',
  ])('%s keeps the configured API origin', async (host) => {
    const { isPracticeCustomDomain, resolveApiBase } = await load();
    expect(isPracticeCustomDomain(host)).toBe(false);
    expect(resolveApiBase(host, `https://${host}`)).not.toContain(`${host}/api`);
  });

  it('is case-insensitive about the host', async () => {
    const { isPracticeCustomDomain } = await load();
    expect(isPracticeCustomDomain('DR-Smith.UnclutterDesk.com')).toBe(false);
    expect(isPracticeCustomDomain('Chente.COM')).toBe(true);
  });
});
