import { describe, it, expect } from 'vitest';
import { allRoutes, reachableBy } from './test-support/routes';
import { CLINICAL, PRACTICE_ROLES, STAFF } from './common/roles';

/**
 * Exactly which routes a client can reach.
 *
 * A client is a person receiving care. They hold a real session in the
 * practice's tenant, so the only thing standing between them and a staff
 * endpoint is the role annotation on it — and `@AnyAuthenticated()` opens a
 * route to every role, clients included.
 *
 * roles.spec.ts proves every authenticated route carries an annotation.
 * roles.guard.spec.ts proves the guard honours it. Neither notices an
 * annotation that is simply too generous: a route marked `@AnyAuthenticated()`
 * that returns another person's records passes both.
 *
 * So the surface is pinned. Widening it is then a visible line in a diff,
 * reviewed on purpose, rather than a decorator someone reached for because the
 * route "needed to work for clients too".
 */
const ROUTES = allRoutes();

/**
 * Every route a CLIENT may call today. Each is about that client's own
 * account, their own care, or their own messages.
 */
const CLIENT_SURFACE = [
  // Their own account
  'GET /v1/auth/preferences',
  'PUT /v1/auth/preferences',
  'POST /v1/auth/change-password',
  'GET /v1/auth/status',
  'GET /v1/auth/sessions',
  'POST /v1/auth/sessions/revoke-others',
  'DELETE /v1/auth/sessions/:id',

  // Their own care
  'GET /v1/consult/portal',
  'GET /v1/consult/portal/payments',
  'GET /v1/consult/portal/bookings/:bookingId/reschedule-options',
  'POST /v1/consult/portal/bookings/:bookingId/reschedule',

  // Their own messages
  'GET /v1/notifications',
  'GET /v1/notifications/unread-count',
  'PATCH /v1/notifications/:id/read',
  'PATCH /v1/notifications/:id/archive',
  'POST /v1/notifications/read-all',
  'GET /v1/notifications/preferences',
  'PUT /v1/notifications/preferences',
  'GET /v1/notifications/push/key',
  'POST /v1/notifications/push/subscribe',
  'DELETE /v1/notifications/push/subscribe',
  'GET /v1/notifications/stream',

  // Signup utility: answers whether a practice slug is taken.
  'GET /v1/tenant/check-slug/:slug',
].sort();

describe('the routes a client can reach', () => {
  it('found a realistic route table', () => {
    // A parser that silently matched nothing would make everything below pass.
    expect(ROUTES.length).toBeGreaterThan(80);
    expect(ROUTES.filter((r) => r.authenticated).length).toBeGreaterThan(50);
  });

  it('is exactly the reviewed set', () => {
    const actual = reachableBy('CLIENT', ROUTES)
      .map((r) => r.target)
      .sort();
    // A failure here is not necessarily a bug — it means the client-facing
    // surface changed, and the change should be looked at and this list
    // updated deliberately.
    expect(actual).toEqual(CLIENT_SURFACE);
  });

  it('includes nothing clinical', () => {
    const clinicalOnly = ROUTES.filter(
      (r) => r.roles.length > 0 && r.roles.every((role) => CLINICAL.includes(role)),
    ).map((r) => r.target);
    for (const target of CLIENT_SURFACE) {
      expect(clinicalOnly, `${target} is clinical and must not be client-reachable`).not.toContain(
        target,
      );
    }
  });

  /*
   * A client-facing route must derive its subject from the session, never from
   * a parameter naming a person. `:profileId` in a path a client can call is
   * the shape of the original bug, where the portal was looked up by an email
   * address anyone could supply.
   */
  it('never names another person in the path', () => {
    const naming = reachableBy('CLIENT', ROUTES).filter((r) =>
      /:(profileId|clientProfileId|userId|therapistId|tenantId)\b/.test(r.path),
    );
    expect(naming.map((r) => r.target)).toEqual([]);
  });

  it('exposes no route that writes another account', () => {
    const writes = reachableBy('CLIENT', ROUTES).filter((r) => r.verb !== 'Get');
    for (const route of writes) {
      // Each write is either about the caller, or addressed by an id the
      // service scopes to them — never by a role, tenant or staff identifier.
      expect(route.path).not.toMatch(/\/(staff|therapists|admin|tenants)\b/);
    }
  });
});

describe('the routes a receptionist can reach', () => {
  it('is a real subset of staff, not everything', () => {
    const receptionist = reachableBy('RECEPTIONIST', ROUTES).length;
    const owner = reachableBy('OWNER', ROUTES).length;
    expect(receptionist).toBeGreaterThan(0);
    expect(receptionist).toBeLessThan(owner);
  });

  // They book and reschedule; they do not read what was discussed.
  it('excludes every clinical-only route', () => {
    const forbidden = ROUTES.filter(
      (r) => r.roles.length > 0 && r.roles.every((role) => CLINICAL.includes(role)),
    );
    const reachable = new Set(reachableBy('RECEPTIONIST', ROUTES).map((r) => r.target));
    expect(forbidden.filter((r) => reachable.has(r.target)).map((r) => r.target)).toEqual([]);
  });
});

describe('platform admin routes', () => {
  it('are reachable by no practice role', () => {
    const platform = ROUTES.filter((r) => r.platformAdmin);
    expect(platform.length).toBeGreaterThan(0);
    for (const role of PRACTICE_ROLES) {
      const reachable = new Set(reachableBy(role, ROUTES).map((r) => r.target));
      expect(platform.filter((r) => reachable.has(r.target)).map((r) => r.target)).toEqual([]);
    }
  });
});

describe('the role matrix', () => {
  it('gives every authenticated route at least one role that can call it', () => {
    // A route no role can reach is dead, and usually means a typo in the
    // annotation rather than a deliberate lockout.
    const unreachable = ROUTES.filter(
      (r) => r.authenticated && !r.platformAdmin && r.roles.length === 0,
    );
    expect(unreachable.map((r) => r.target)).toEqual([]);
  });

  it('grants no practice role a route under /v1/admin', () => {
    for (const role of STAFF) {
      for (const route of reachableBy(role, ROUTES)) {
        expect(route.path.startsWith('/v1/admin')).toBe(false);
      }
    }
  });
});
