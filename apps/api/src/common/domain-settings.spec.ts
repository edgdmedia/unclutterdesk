import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Every production address is a setting (spec §4.1a), so the move to new
 * domains (§4.1b) is a change of .env, not of code. The settings are read when
 * the module loads, so each case loads a fresh copy.
 */
async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import('./origins');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('domain settings', () => {
  it('follow TENANT_ROOT_DOMAIN for practice subdomains and platform hosts', async () => {
    const o = await load({ TENANT_ROOT_DOMAIN: 'therapysts.app' });
    expect(o.TENANT_ROOT_DOMAIN).toBe('therapysts.app');
    expect(o.isPlatformOrigin('https://dr-smith.therapysts.app', true)).toBe(true);
    expect(o.isPlatformOrigin('https://dr-smith.therapysts.app.evil.com', true)).toBe(false);
    expect(o.tenantWebOrigin({ slug: 'dr-smith' }, true)).toBe('https://dr-smith.therapysts.app');
    expect(o.FALLBACK_SENDER_ADDRESS).toBe('no-reply@therapysts.app');
  });

  it('treat the root domain as a literal, not a pattern', async () => {
    const o = await load({ TENANT_ROOT_DOMAIN: 'therapysts.app' });
    expect(o.isPlatformOrigin('https://dr-smith.therapystsXapp', true)).toBe(false);
  });

  it('take the marketing site and its www from MARKETING_URL', async () => {
    const o = await load({ MARKETING_URL: 'https://therapysts.com/' });
    expect(o.ROOT_ORIGINS).toEqual(['https://therapysts.com', 'https://www.therapysts.com']);
  });

  it('keep the app origin its own setting, not derived from the root domain', async () => {
    const o = await load({ TENANT_ROOT_DOMAIN: 'therapysts.app', APP_URL: 'https://therapysts.app' });
    expect(o.appOrigin(true)).toBe('https://therapysts.app');
  });

  it('keep the calendar UID domain fixed whatever the root domain', async () => {
    const o = await load({ TENANT_ROOT_DOMAIN: 'therapysts.app' });
    expect(o.ICAL_UID_DOMAIN).toBe('unclutterdesk.com');
  });

  it('read the profile origin from PROFILE_PUBLIC_URL', async () => {
    const o = await load({ PROFILE_PUBLIC_URL: 'https://therapysts.com/' });
    expect(o.PROFILE_PUBLIC_ORIGIN).toBe('https://therapysts.com');
  });

  describe('the custom-domain CNAME target', () => {
    it('is CUSTOM_DOMAIN_TARGET, normalised', async () => {
      const o = await load({ CUSTOM_DOMAIN_TARGET: 'Customers.Therapysts.app.', CLOUDFLARE_SAAS_CNAME_TARGET: 'old.example' });
      expect(o.customDomainTarget()).toBe('customers.therapysts.app');
    });

    it('falls back to CLOUDFLARE_SAAS_CNAME_TARGET, so an existing .env keeps working', async () => {
      const o = await load({ CUSTOM_DOMAIN_TARGET: '', CLOUDFLARE_SAAS_CNAME_TARGET: 'customers.example.com' });
      expect(o.customDomainTarget()).toBe('customers.example.com');
    });

    it('is null when neither is set', async () => {
      const o = await load({ CUSTOM_DOMAIN_TARGET: '', CLOUDFLARE_SAAS_CNAME_TARGET: '' });
      expect(o.customDomainTarget()).toBeNull();
    });
  });

  it('give the production CSRF cookie the tenant root domain unless COOKIE_DOMAIN says otherwise', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TENANT_ROOT_DOMAIN', 'therapysts.app');
    vi.stubEnv('COOKIE_DOMAIN', '');
    const derived = await import('./auth.config');
    expect(derived.csrfCookieOptions().domain).toBe('.therapysts.app');

    vi.resetModules();
    vi.stubEnv('COOKIE_DOMAIN', '.example.org');
    const overridden = await import('./auth.config');
    expect(overridden.csrfCookieOptions().domain).toBe('.example.org');
  });
});
