import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

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
 */
const MODULES = resolve(__dirname, 'modules');

function controllers(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...controllers(path));
    else if (entry.endsWith('.controller.ts') && !entry.includes('.spec.')) out.push(path);
  }
  return out;
}

interface Route {
  file: string;
  verb: string;
  path: string;
  authenticated: boolean;
  platformAdmin: boolean;
  hasRoles: boolean;
}

function routesIn(file: string): Route[] {
  const src = readFileSync(file, 'utf8');
  const rows: Route[] = [];

  // A file may hold more than one controller (privacy has a platform-admin one).
  const classes = src.split(/(?=@ApiTags\()/).filter((c) => c.includes('@Controller('));

  for (const cls of classes) {
    const header = cls.slice(0, cls.indexOf('export class') >= 0 ? cls.indexOf('export class') : 0);
    const clsJwt = /@UseGuards\([^)]*JwtAuthGuard/.test(header);
    const clsPlatform = /@UseGuards\([^)]*PlatformAdminGuard/.test(header);
    const clsRoles = /@Roles\(|@AnyAuthenticated\(\)/.test(header);
    const prefix = (cls.match(/@Controller\('([^']*)'\)/) || [, ''])[1];

    const body = cls.slice(cls.indexOf('export class'));
    const lines = body.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^ {2}@(Get|Post|Patch|Put|Delete)\('?([^')]*)'?\)/);
      if (!m) continue;

      // A decorator run brackets the route on both sides: @Roles is conventionally
      // written above @Get, and @UseGuards below it. Collect contiguous decorator
      // lines in both directions, stopping at the handler signature.
      let start = i;
      while (start > 0 && /^ {2}@/.test(lines[start - 1])) start -= 1;
      let end = i;
      while (end + 1 < lines.length && /^ {2}(@|\s*$)/.test(lines[end + 1])) {
        if (/^ {2}(async )?[a-zA-Z_]\w*\s*\(/.test(lines[end + 1])) break;
        end += 1;
      }
      const deco = lines.slice(start, end + 1).join('\n');

      rows.push({
        file: file.slice(file.indexOf('modules')),
        verb: m[1],
        path: '/' + [prefix, m[2]].filter(Boolean).join('/'),
        authenticated: clsJwt || /@UseGuards\([^)]*JwtAuthGuard/.test(deco),
        platformAdmin: clsPlatform || /@UseGuards\([^)]*PlatformAdminGuard/.test(deco),
        hasRoles: clsRoles || /@Roles\(|@AnyAuthenticated\(\)/.test(deco),
      });
    }
  }
  return rows;
}

describe('route authorisation', () => {
  const all = controllers(MODULES).flatMap(routesIn);

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
    for (const file of controllers(MODULES)) {
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
        controllers(MODULES).find((f) => f.includes(route!.file.split('/')[1]))!,
        'utf8',
      );
      expect(src, `${target} must not be open to every authenticated user`).not.toMatch(
        /@AnyAuthenticated\(\)[\s\S]{0,200}@(Get|Post|Patch)\('client\/:clientProfileId'/,
      );
    }
  });
});
