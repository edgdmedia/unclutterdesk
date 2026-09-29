import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PRACTICE_ROLES, type PracticeRole } from '../common/roles';
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '../common/permissions';

/**
 * The route table, read from the controllers.
 *
 * Shared by every test that reasons about authorisation, so those tests cannot
 * drift into disagreeing about what the routes are — the same reason the origin
 * rules live in one module rather than being restated per call site.
 */
const MODULES = resolve(__dirname, '..', 'modules');

export function controllerFiles(dir: string = MODULES): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...controllerFiles(path));
    else if (entry.endsWith('.controller.ts') && !entry.includes('.spec.')) out.push(path);
  }
  return out;
}

export interface Route {
  file: string;
  verb: string;
  path: string;
  target: string;
  authenticated: boolean;
  platformAdmin: boolean;
  hasPermissions: boolean;
  permissions: Permission[];
  /** The roles the admitted permissions map to. Empty when the route carries none. */
  roles: PracticeRole[];
}

/** Resolves @Permissions('a', 'b') to its key list. */
function permissionsFrom(decorators: string): Permission[] {
  const call = decorators.match(/@Permissions\(([^)]*)\)/);
  if (!call) return [];
  const keys: Permission[] = [];
  for (const raw of call[1].split(',')) {
    const m = raw.trim().match(/^'([a-z.-]+)'$/);
    if (m && (PERMISSIONS as readonly string[]).includes(m[1])) keys.push(m[1] as Permission);
  }
  return keys;
}

/** The roles a permission key admits — used by the surface tests. */
export function rolesFor(permission: Permission): PracticeRole[] {
  return (PRACTICE_ROLES as readonly string[]).filter((r) =>
    (ROLE_PERMISSIONS[r as PracticeRole] as readonly string[]).includes(permission),
  ) as PracticeRole[];
}

export function routesIn(file: string): Route[] {
  const src = readFileSync(file, 'utf8');
  const rows: Route[] = [];

  // A file may hold more than one controller (privacy has a platform-admin one).
  const classes = src.split(/(?=@ApiTags\()/).filter((c) => c.includes('@Controller('));

  for (const cls of classes) {
    const header = cls.slice(0, cls.indexOf('export class') >= 0 ? cls.indexOf('export class') : 0);
    const clsJwt = /@UseGuards\([^)]*JwtAuthGuard/.test(header);
    const clsPlatform = /@UseGuards\([^)]*PlatformAdminGuard/.test(header);
    const clsPermissions = /@Permissions\(/.test(header);
    const prefix = (cls.match(/@Controller\('([^']*)'\)/) || [, ''])[1];

    const body = cls.slice(cls.indexOf('export class'));
    const lines = body.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^ {2}@(Get|Post|Patch|Put|Delete)\('?([^')]*)'?\)/);
      if (!m) continue;

      // A decorator run brackets the route on both sides: @Roles is conventionally
      // written above @Get, and @UseGuards below it.
      let start = i;
      while (start > 0 && /^ {2}@/.test(lines[start - 1])) start -= 1;
      let end = i;
      while (end + 1 < lines.length && /^ {2}(@|\s*$)/.test(lines[end + 1])) {
        if (/^ {2}(async )?[a-zA-Z_]\w*\s*\(/.test(lines[end + 1])) break;
        end += 1;
      }
      const deco = lines.slice(start, end + 1).join('\n');
      const path = '/' + [prefix, m[2]].filter(Boolean).join('/');

      const route = {
        file: file.slice(file.indexOf('modules')),
        verb: m[1],
        path,
        target: `${m[1].toUpperCase()} ${path}`,
        authenticated: clsJwt || /@UseGuards\([^)]*JwtAuthGuard/.test(deco),
        platformAdmin: clsPlatform || /@UseGuards\([^)]*PlatformAdminGuard/.test(deco),
        hasPermissions: clsPermissions || /@Permissions\(/.test(deco),
        permissions: permissionsFrom(clsPermissions ? header + '\n' + deco : deco),
        roles: [] as PracticeRole[],
      };
      route.roles = [...new Set(route.permissions.flatMap(rolesFor))].sort() as PracticeRole[];
      rows.push(route);
    }
  }
  return rows;
}

export function allRoutes(): Route[] {
  return controllerFiles().flatMap(routesIn);
}

/** Routes a signed-in profile with this role may call. */
export function reachableBy(role: PracticeRole, routes: Route[] = allRoutes()): Route[] {
  return routes.filter((r) => r.authenticated && !r.platformAdmin && r.roles.includes(role));
}
