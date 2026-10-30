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
) as { routes: string[] };
const ROUTES = allRoutes();
const byTarget = new Map(ROUTES.map((r) => [r.target, r]));
const clientReachable = new Set(reachableBy('CLIENT', ROUTES).map((r) => r.target));

/** Public routes that are not the client's: staff invites, owner signup, webhooks, OAuth callbacks. */
const NEVER_PROXIED = [
  'POST /v1/admin/auth/login',
  'POST /v1/auth/register',
  'POST /v1/auth/invite/claim',
  'POST /v1/tenant/register',
  'GET /v1/tenant/public/invite/:claimToken',
  'GET /v1/tenant/check-slug/:slug',
  'GET /v1/invites/check/:code',
  'GET /v1/calendar/google/callback',
  'POST /v1/billing/paystack-webhook',
  'POST /v1/video/webhooks/daily',
  'POST /v1/webhooks/resend',
];

describe('the custom-domain proxy allow-list', () => {
  it('is not empty and has no duplicates', () => {
    expect(LIST.routes.length).toBeGreaterThan(30);
    expect(new Set(LIST.routes).size).toBe(LIST.routes.length);
  });

  it.each(LIST.routes)('%s is a real route, public or client-reachable', (target) => {
    const route = byTarget.get(target);
    expect(route, `${target} is not an API route`).toBeDefined();
    expect(route!.platformAdmin).toBe(false);
    if (route!.authenticated) {
      expect(clientReachable.has(target), `${target} needs a session a client can't hold`).toBe(true);
    }
  });

  it('leaves out staff, owner-signup, webhook and admin routes', () => {
    for (const target of NEVER_PROXIED) expect(LIST.routes).not.toContain(target);
  });

  it('covers everything a client can reach, so the client portal works through the proxy', () => {
    const missing = [...clientReachable].filter((t) => !LIST.routes.includes(t) && !NEVER_PROXIED.includes(t));
    expect(missing).toEqual([]);
  });
});
