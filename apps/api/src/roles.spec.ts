import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { controllerFiles, routesIn, allRoutes } from './test-support/routes';

/**
 * Every authenticated route must declare which roles may call it.
 *
 * Before this existed, controllers carried `@UseGuards(JwtAuthGuard)` and
 * nothing else, which authenticates identity but authorises nothing — so a
 * signed-in client could read another client's SOAP notes, change practice
 * billing, or deactivate a practitioner. Adding role decorators fixes today's
 * routes; this test is what stops the next route from repeating it, because a
 * new endpoint with no `@Roles` fails the build rather than quietly inheriting
 * "any authenticated user".
 *
 * Public routes are unaffected: with no auth guard there is no role to check.
 *
 * The parser lives in test-support/routes.ts, shared with client-surface.spec,
 * so the two cannot drift into disagreeing about what the routes are.
 */
describe('route authorisation', () => {
  const all = allRoutes();

  it('parses a realistic number of routes', () => {
    // Guards against a regex that silently matches nothing, which would make
    // the checks below pass vacuously.
    expect(all.length).toBeGreaterThan(70);
  });

  it('every authenticated route declares its roles', () => {
    const missing = all
      .filter((r) => r.authenticated && !r.platformAdmin && !r.hasRoles)
      .map((r) => `${r.file}  ${r.verb} ${r.path}`);

    expect(
      missing,
      'These routes authenticate the caller but authorise nothing, so any ' +
        'signed-in account — including a client — can reach them. Add @Roles(...) ' +
        'or, if clients genuinely belong there, @AnyAuthenticated().\n' +
        missing.join('\n'),
    ).toEqual([]);
  });

  it('routes behind a role decorator also carry RolesGuard', () => {
    // @Roles without the guard is inert — the metadata is set and nobody reads it.
    const unenforced: string[] = [];
    for (const file of controllerFiles()) {
      const src = readFileSync(file, 'utf8');
      const declares = /@Roles\(|@AnyAuthenticated\(\)/.test(src);
      if (declares && !src.includes('RolesGuard')) {
        unenforced.push(file.slice(file.indexOf('modules')));
      }
    }
    expect(unenforced, 'Role decorators here are never enforced').toEqual([]);
  });

  it('clinical routes exclude receptionists and clients', () => {
    // The endpoints that return SOAP notes or assessment answers.
    const clinical = [
      'POST /v1/notes',
      'GET /v1/notes/client/:clientProfileId',
      'GET /v1/tenant/clients/:profileId',
      'GET /v1/intake/submissions',
      'GET /v1/consult/therapist/bookings/:bookingId/prep',
    ];

    for (const target of clinical) {
      const [verb, path] = target.split(' ');
      const route = all.find((r) => r.verb.toUpperCase() === verb && r.path === path);
      expect(route, `${target} not found — did the path change?`).toBeDefined();
      expect(route!.hasRoles, `${target} has no role restriction`).toBe(true);

      const src = readFileSync(
        controllerFiles().find((f) => f.includes(route!.file.split('/')[1]))!,
        'utf8',
      );
      expect(src, `${target} must not be open to every authenticated user`).not.toMatch(
        /@AnyAuthenticated\(\)[\s\S]{0,200}@(Get|Post|Patch)\('client\/:clientProfileId'/,
      );
    }
  });
});
