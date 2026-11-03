import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { allRoutes, reachableBy } from '../test-support/routes';

/*
 * The tenant router forwards only these routes from a practice custom domain
 * (apps/tenant-router/src/client-api-routes.json, spec §6.16). They must be
 * real routes, and each must be public or reachable by a client: never an
 * admin, platform or practice-dashboard route. Widening the list is a
 * reviewed change to that file, and this test holds it to the client surface.
 */
const LIST = JSON.parse(
  readFileSync(resolve(__dirname, '../../../tenant-router/src/client-api-routes.json'), 'utf8'),
).routes as string[];
const NEVER_PROXIED: string[] = [
  // Public-profile site reads (§6.11): called server-side by apps/profiles, never from a practice domain
  'GET /v1/profiles/sitemap',
  'GET /v1/profiles/:handle',
  // Staff invite check endpoint that runs before a session exists
  'GET /v1/invites/check/:code',
  // Calendar integration OAuth callback
  'GET /v1/calendar/google/callback',
  // Payment gateway webhook endpoint
  'POST /v1/billing/paystack-webhook',
  // Video conferencing webhook endpoint
  'POST /v1/video/webhooks/daily',
  // Resend webhook endpoint
  'POST /v1/webhooks/resend',
  // Claim token verification for public invites
  'GET /v1/tenant/public/invite/:claimToken',
  // Tenant slug availability check (public but not for booking)
  'GET /v1/tenant/check-slug/:slug',
  // Plans for the public pricing page (the profiles site renders them server-side)
  'GET /v1/billing/plans',
  // Admin authentication endpoint
  'POST /v1/admin/auth/login',
  // Client self-registration endpoint
  'POST /v1/auth/register',
  // Invite claim endpoint (auth flow, not client booking)
  'POST /v1/auth/invite/claim',
];
const ROUTES = allRoutes();
const byTarget = new Map(ROUTES.map((r) => [r.target, r]));
const clientReachable = new Set(reachableBy('CLIENT', ROUTES).map((r) => r.target));

describe('the custom-domain proxy allow-list', () => {
  it('is not empty and has no duplicates', () => {
    expect(LIST.length).toBeGreaterThan(30);
    expect(new Set(LIST).size).toBe(LIST.length);
  });

  it('each entry is a real route that is client-reachable', () => {
    for (const target of LIST) {
      const route = byTarget.get(target);
      expect(route, `${target} is not an API route`).toBeDefined();
      expect(route!.platformAdmin).toBe(false);
      if (route!.authenticated) {
        expect(clientReachable.has(target), `${target} needs a session a client can't hold`).toBe(true);
      }
    }
  });

  it('covers everything a client can reach, so the client portal works through the proxy', () => {
    const missing = [...clientReachable].filter((t) => !LIST.includes(t) && !NEVER_PROXIED.includes(t));
    expect(missing).toEqual([]);
  });

  it('leaves out staff, owner-signup, webhook and admin routes', () => {
    for (const target of NEVER_PROXIED) expect(LIST).not.toContain(target);
  });
});