import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_HOST, MARKETING_HOST, TENANT_ROOT_DOMAIN } from '../../config/domains';

/*
 * What the page's host means, worked out from the domain config (spec §4.1a)
 * rather than spelled-out domains, so the same code serves the new domains
 * after the move (§4.1b).
 */
async function onHost(hostname: string) {
  vi.resetModules();
  vi.stubGlobal('location', { ...window.location, hostname, origin: `https://${hostname}`, port: '' });
  return import('../apiClient');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('host classification', () => {
  it('treats the app host as the app', async () => {
    const { getAppType, getSubdomainTenantSlug } = await onHost(APP_HOST);
    expect(getAppType()).toBe('app');
    expect(getSubdomainTenantSlug()).toBeNull();
  });

  it.each([MARKETING_HOST, `www.${MARKETING_HOST}`])('treats %s as marketing, never a practice', async (host) => {
    const { getAppType, getSubdomainTenantSlug } = await onHost(host);
    expect(getAppType()).toBe('marketing');
    expect(getSubdomainTenantSlug()).toBeNull();
  });

  it('reads the practice slug from a subdomain of the tenant root', async () => {
    const { getAppType, getSubdomainTenantSlug } = await onHost(`dr-smith.${TENANT_ROOT_DOMAIN}`);
    expect(getAppType()).toBe('booking');
    expect(getSubdomainTenantSlug()).toBe('dr-smith');
  });

  it('has no admin host: admin.<root> is a reserved name, not the admin app or a practice', async () => {
    const { getAppType, getSubdomainTenantSlug } = await onHost(`admin.${TENANT_ROOT_DOMAIN}`);
    expect(getAppType()).not.toBe('app');
    expect(getSubdomainTenantSlug()).toBeNull();
  });

  it('names a custom domain by its whole host', async () => {
    const { getAppType, getSubdomainTenantSlug } = await onHost('chente.com');
    expect(getAppType()).toBe('booking');
    expect(getSubdomainTenantSlug()).toBe('chente.com');
  });

  it('does not take a Pages preview host for a practice domain', async () => {
    const { getSubdomainTenantSlug, isPracticeCustomDomain } = await onHost('abc123.app-unclutterdesk.pages.dev');
    expect(isPracticeCustomDomain('abc123.app-unclutterdesk.pages.dev')).toBe(false);
    expect(getSubdomainTenantSlug()).toBeNull();
  });
});
