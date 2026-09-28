# Sessions Register, Session Page and Permissions RBAC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace role-list route guards with a named-permission RBAC (role map
+ per-person grants on the already-existing `Profile.permissions`), migrate
every route to it, then build on top: a practice Sessions register, a
single-session hub page (status, payment, start/prep/note links, reschedule,
summary + client recap), and session + payment history on the client page.

**Architecture:**
- `apps/api/src/common/permissions.ts` holds the catalog, the role→permission
  map and the grant rules. `RolesGuard` keeps its name and its place in every
  `@UseGuards(...)` line but checks `@Permissions(...)` metadata against the
  caller's effective set (role map ∪ grants), read from the profile row per
  request, exactly as the role is read today.
- The `@Roles` → `@Permissions` migration is mechanical and
  behaviour-preserving: the map reproduces each old group 1:1. The route-guard
  test enforces that every authenticated route carries `@Permissions`.
- Sessions live in a new `SessionDirectoryService` in the consult module,
  exposed under `/v1/consult/practice/sessions…`. The app adds `SessionsPage`
  and `SessionDetailPage`, a permissions dialog on the team page, and two tabs
  on the client page.

**Tech Stack:** NestJS 10 + Prisma 5.22 (Postgres), React 18 + Vite +
Tailwind 4 (container queries), Vitest 2 + Testing Library, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-28-sessions-rbac-design.md`.

## Global Constraints

- **Branch and PRs:** work on `dev`; `git push origin dev`; open a PR from
  `dev` to `main` with `gh` only if none is open
  (`gh pr list --head dev --state open`). Never push to `main`.
- **Commit trailer:** every commit ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **PR trailer:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Migrations:** hand-written SQL under
  `prisma/migrations/<timestamp>_<name>/migration.sql`; apply with
  `npx prisma migrate deploy --schema prisma/schema.prisma && npx prisma generate --schema prisma/schema.prisma`
  from the repo root.
- **Commands (repo root):** API tests `cd apps/api && npx vitest run <path>`;
  app tests `cd apps/app && npx vitest run <path>`; typechecks
  `cd apps/api && npx tsc --noEmit -p tsconfig.json` and `cd apps/app && npx tsc --noEmit`;
  package `pnpm --filter @unclutterdesk/ui test`.
- **Tenant scoping:** every query by `authenticatedTenantId(req)`, never from the body.
- **Role groups today** (`apps/api/src/common/roles.ts`): `STAFF` = OWNER,
  ADMIN, THERAPIST, RECEPTIONIST; `CLINICAL` = OWNER, ADMIN, THERAPIST;
  `FRONT_DESK` = OWNER, ADMIN, RECEPTIONIST; `PRACTICE_ADMIN` = OWNER, ADMIN.
- **The guard test is law:** from Task 4 onwards every authenticated route
  carries `@Permissions(...)`; `roles.spec.ts` and `client-surface.spec.ts`
  pass at every commit.
- **App tests never fake `@unclutterdesk/ui`** (the layout-rules test enforces
  it); render with `renderWithApp` from `apps/app/src/test/renderWithApp.tsx`
  and fake only `utils/apiClient`.
- **Copy:** plain English; errors say what to do next.
- **Open decision defaults** (change only if the owner says otherwise):
  (a) a therapist may complete their own sessions but not reschedule —
  reschedule is `sessions.edit` (desk/admin); (b) the recap email is manual
  ("Send recap"), never automatic; (c) "view own sessions" is implicit — any
  staff member without `sessions.view-all` sees only their own diary; there is
  no separate key.

---

## File map

**API: RBAC core**
- Create `apps/api/src/common/permissions.ts` — catalog, `ROLE_PERMISSIONS`, `GRANTABLE`, `@Permissions`, `effectivePermissions`.
- Modify `apps/api/src/common/roles.guard.ts` — read `PERMISSIONS_KEY`, load `permissions` with the profile.
- Modify `apps/api/src/common/roles.ts` — delete `Roles`, `ROLES_KEY`, `AnyAuthenticated` (Task 4); keep the role arrays.
- Modify `apps/api/src/test-support/routes.ts` — parse `@Permissions`.
- Modify `apps/api/src/roles.spec.ts` and `apps/api/src/client-surface.spec.ts`.
- Modify the 15 controllers under `apps/api/src/modules/**` — decorator swap only.
- Tests: `apps/api/src/common/permissions.spec.ts`, `apps/api/src/common/roles.guard.spec.ts`.

**API: grants**
- Modify `apps/api/src/modules/tenant/tenant.service.ts` — staff rows gain `permissions`; new `updateStaffPermissions`.
- Modify `apps/api/src/modules/tenant/tenant.controller.ts` — `PATCH staff/:profileId/permissions`.
- Modify `apps/api/src/modules/auth/auth.service.ts` — `practiceProfile()` gains `permissions`.
- Test: `apps/api/src/modules/tenant/staff-permissions.spec.ts`.

**API: sessions**
- Modify `prisma/schema.prisma` + create `prisma/migrations/20260928150000_session_summaries/migration.sql`.
- Create `apps/api/src/modules/consult/session-directory.service.ts`.
- Modify `apps/api/src/modules/consult/consult.controller.ts` and `consult.module.ts`.
- Test: `apps/api/src/modules/consult/session-directory.spec.ts`.

**App**
- Modify `apps/app/src/context/AuthContext.tsx` — `AuthProfile.permissions`.
- Create `apps/app/src/components/team/PermissionsDialog.tsx`; modify `TeamSettingsPage.tsx`.
- Create `apps/app/src/pages/practice/SessionsPage.tsx`, `apps/app/src/pages/practice/SessionDetailPage.tsx`.
- Modify `apps/app/src/App.tsx` (lazy imports, routes, `StaffMember.permissions`), `apps/app/src/components/shell/practiceNav.tsx` (nav entry), `apps/app/src/pages/practice/ClientDetailPage.tsx` (sessions + payments tabs).
- Tests: `apps/app/src/components/team/__tests__/PermissionsDialog.test.tsx`, `apps/app/src/pages/__tests__/SessionsPage.test.tsx`, `apps/app/src/pages/__tests__/SessionDetailPage.test.tsx`, client-page tab tests.

---

## Part A: the permission system

### Task 1: Catalog, decorator, effective set

**Files:**
- Create: `apps/api/src/common/permissions.ts`
- Test: `apps/api/src/common/permissions.spec.ts`

**Interfaces:**
- Produces:
  - `export const PERMISSIONS = [...] as const;` and `export type Permission = (typeof PERMISSIONS)[number];`
  - `export const ROLE_PERMISSIONS: Record<PracticeRole, Permission[]>`
  - `export const GRANTABLE: Permission[]` — everything except `practice.owner`, `any.authenticated`, `staff.manage`
  - `export const PERMISSIONS_KEY = 'requiredPermissions';`
  - `export const Permissions = (...keys: Permission[]) => SetMetadata(PERMISSIONS_KEY, keys);`
  - `export function effectivePermissions(role: string, grants: readonly string[]): Set<Permission>`

- [ ] **Step 1: Write the failing test**

`apps/api/src/common/permissions.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CLINICAL, FRONT_DESK, PRACTICE_ADMIN, STAFF } from './roles';
import { GRANTABLE, PERMISSIONS, ROLE_PERMISSIONS, effectivePermissions, type Permission } from './permissions';

const has = (role: string, set: Permission[]) => PERMISSIONS.filter((p) => set.includes(p));

describe('ROLE_PERMISSIONS reproduces the old groups exactly', () => {
  it('practice.staff is what STAFF was', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST']) {
      expect(effectivePermissions(role, []).has('practice.staff')).toBe((STAFF as readonly string[]).includes(role));
    }
    expect(effectivePermissions('CLIENT', []).has('practice.staff')).toBe(false);
  });
  it('clinical.record is what CLINICAL was', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST', 'CLIENT']) {
      expect(effectivePermissions(role, []).has('clinical.record')).toBe((CLINICAL as readonly string[]).includes(role));
    }
  });
  it('practice.admin is what PRACTICE_ADMIN was', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST']) {
      expect(effectivePermissions(role, []).has('practice.admin')).toBe((PRACTICE_ADMIN as readonly string[]).includes(role));
    }
  });
  it('payments.desk is what FRONT_DESK was', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST']) {
      expect(effectivePermissions(role, []).has('payments.desk')).toBe((FRONT_DESK as readonly string[]).includes(role));
    }
  });
  it('every role, client included, holds any.authenticated', () => {
    for (const role of ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST', 'CLIENT']) {
      expect(effectivePermissions(role, []).has('any.authenticated')).toBe(true);
    }
  });
});

describe('grants', () => {
  it('add permissions to a role', () => {
    const e = effectivePermissions('THERAPIST', ['sessions.edit']);
    expect(e.has('sessions.edit')).toBe(true);
    expect(e.has('practice.admin')).toBe(false);
  });
  it('ignore unknown keys and non-grantable ones', () => {
    const e = effectivePermissions('THERAPIST', ['practice.owner', 'made.up', 'any.authenticated']);
    expect(e.has('made.up')).toBe(false);
    expect(e.has('practice.owner')).toBe(false);
  });
  it('an owner holds practice.owner; nobody else does', () => {
    expect(effectivePermissions('OWNER', []).has('practice.owner')).toBe(true);
    expect(effectivePermissions('ADMIN', []).has('practice.owner')).toBe(false);
  });
  it('an unknown role has nothing beyond any.authenticated', () => {
    const e = effectivePermissions('WIZARD', []);
    expect([...e]).toEqual(['any.authenticated']);
  });
});

describe('catalog hygiene', () => {
  it('every role maps only to catalog keys', () => {
    for (const list of Object.values(ROLE_PERMISSIONS)) {
      for (const p of list) expect(PERMISSIONS).toContain(p);
    }
  });
  it('GRANTABLE excludes the three structural keys', () => {
    expect(GRANTABLE).not.toContain('practice.owner');
    expect(GRANTABLE).not.toContain('any.authenticated');
    expect(GRANTABLE).not.toContain('staff.manage');
    expect(has('ADMIN', GRANTABLE).length).toBe(GRANTABLE.length);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd apps/api && npx vitest run src/common/permissions.spec.ts`
Expected: FAIL, "Failed to resolve import './permissions'".

- [ ] **Step 3: Implement**

`apps/api/src/common/permissions.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import type { PracticeRole } from './roles';

/**
 * Every thing a route can ask for. The five coarse keys mirror the role
 * groups the API used to check directly (see ROLE_PERMISSIONS below); the
 * fine keys exist for the sessions feature.
 */
export const PERMISSIONS = [
  'practice.owner',       // the owner alone: deleting a practice, handing it over
  'practice.admin',       // settings, staff, billing, branding
  'practice.staff',       // anyone who works at the practice
  'clinical.record',      // SOAP notes, assessments, session prep
  'payments.desk',        // money at the front desk: mark paid, payout views
  'any.authenticated',    // every signed-in profile, clients included
  'sessions.view-all',    // every practitioner's diary, not just your own
  'sessions.edit',        // move or cancel any session, change its status
  'sessions.summary',     // internal summary and client recap
  'staff.manage',         // change roles and grants
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * What each role gets, unchanged from the old @Roles groups:
 * PRACTICE_ADMIN → practice.admin, CLINICAL → clinical.record,
 * STAFF → practice.staff, FRONT_DESK → payments.desk. Keeping this a 1:1
 * mirror is what makes the route migration behaviour-preserving.
 */
export const ROLE_PERMISSIONS: Record<PracticeRole, Permission[]> = {
  OWNER: [...PERMISSIONS],
  ADMIN: [
    'practice.admin', 'practice.staff', 'clinical.record', 'payments.desk',
    'any.authenticated', 'sessions.view-all', 'sessions.edit', 'sessions.summary', 'staff.manage',
  ],
  THERAPIST: ['practice.staff', 'clinical.record', 'any.authenticated', 'sessions.summary'],
  RECEPTIONIST: ['practice.staff', 'payments.desk', 'any.authenticated', 'sessions.view-all', 'sessions.edit'],
  CLIENT: ['any.authenticated'],
};

/**
 * What the permissions editor may tick. practice.owner would let an admin
 * make someone an owner's equal by accident; any.authenticated is structural;
 * staff.manage is the key that hands out keys.
 */
export const GRANTABLE: Permission[] = PERMISSIONS.filter(
  (p) => p !== 'practice.owner' && p !== 'any.authenticated' && p !== 'staff.manage',
);

export const PERMISSIONS_KEY = 'requiredPermissions';

/** A route passes when the caller holds any one of the listed keys. */
export const Permissions = (...keys: Permission[]) => SetMetadata(PERMISSIONS_KEY, keys);

/** Role map ∪ grants, with unknown and non-grantable keys dropped. */
export function effectivePermissions(role: string, grants: readonly string[]): Set<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role as PracticeRole] ?? ['any.authenticated']);
  for (const g of grants) {
    if ((GRANTABLE as readonly string[]).includes(g)) set.add(g as Permission);
  }
  return set;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/api && npx vitest run src/common/permissions.spec.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/permissions.ts apps/api/src/common/permissions.spec.ts
git commit -m "Name what routes ask for: a permission catalog that mirrors the role groups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: The guard checks permissions

**Files:**
- Modify: `apps/api/src/common/roles.guard.ts`
- Test: `apps/api/src/common/roles.guard.spec.ts` (create; check first with `git ls-files | grep -i guard.spec`)

**Interfaces:**
- Consumes: Task 1.
- Produces: `RolesGuard` honours `@Permissions` when present and falls back to
  `@Roles` otherwise (one release of overlap; Task 4 deletes the fallback).
  `req.user.permissions` is set for downstream code.

- [ ] **Step 1: Write the failing test**

`apps/api/src/common/roles.guard.spec.ts`:

```ts
import { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard';
import { PERMISSIONS_KEY } from './permissions';
import { ROLES_KEY } from './roles';

const profileRow = { role: 'THERAPIST', status: 'active', permissions: ['sessions.edit'] };

function make(over: Record<string, any> = {}) {
  const prisma: any = {
    profile: { findFirst: vi.fn().mockResolvedValue(over.profile === undefined ? profileRow : over.profile) },
    // assertSessionLive reads these; check session-validity.ts for the exact shape.
    token: { findFirst: vi.fn().mockResolvedValue({ userId: 1n, revokedAt: null }) },
    user: { findFirst: vi.fn().mockResolvedValue({ status: 'active' }) },
  };
  const reflector: any = { getAllAndOverride: vi.fn((key: string) => over.meta?.[key]) };
  const guard = new RolesGuard(reflector, prisma);
  const req: any = { user: { profileId: '6', tenantId: '1', sessionId: 's1', ...(over.user ?? {}) } };
  const context: any = { switchToHttp: () => ({ getRequest: () => req }) };
  return { guard, context, req, prisma };
}

describe('RolesGuard with permissions', () => {
  it('lets a therapist through on a grant their role lacks', async () => {
    const { guard, context } = make({ meta: { [PERMISSIONS_KEY]: ['sessions.edit'] } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
  it('refuses a permission nobody holds', async () => {
    const { guard, context } = make({ meta: { [PERMISSIONS_KEY]: ['practice.admin'] } });
    await expect(guard.canActivate(context)).rejects.toThrow(/permission/i);
  });
  it('passes when any one of the listed keys is held', async () => {
    const { guard, context } = make({ meta: { [PERMISSIONS_KEY]: ['practice.admin', 'clinical.record'] } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
  it('an unannotated route still passes', async () => {
    const { guard, context } = make({ meta: {} });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
  it('hands the role and permissions down to the request', async () => {
    const { guard, context, req } = make({ meta: { [PERMISSIONS_KEY]: ['practice.staff'] } });
    await guard.canActivate(context);
    expect(req.user.role).toBe('THERAPIST');
    expect(req.user.permissions).toEqual(['sessions.edit']);
  });
  it('a suspended profile is refused whatever it was granted', async () => {
    const { guard, context } = make({ profile: { ...profileRow, status: 'inactive' } });
    await expect(guard.canActivate(context)).rejects.toThrow(/not active/i);
  });
  it('still honours @Roles until the migration completes', async () => {
    const { guard, context } = make({ meta: { [ROLES_KEY]: ['THERAPIST'] } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
```

If `assertSessionLive` queries differ from the mocks above, read
`apps/api/src/common/session-validity.ts` and adjust the `prisma` mock — the
guard spec must not stub the guard itself.

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd apps/api && npx vitest run src/common/roles.guard.spec.ts`
Expected: FAIL — the guard ignores `PERMISSIONS_KEY`.

- [ ] **Step 3: Implement**

In `apps/api/src/common/roles.guard.ts`:

1. Imports: add
   `import { PERMISSIONS_KEY, effectivePermissions, type Permission } from './permissions';`
2. Replace the metadata read at the top of `canActivate`:

```ts
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // One release of overlap: routes not yet migrated still carry @Roles, and
    // the guard honours whichever annotation is present. Task 4 of the plan
    // deletes the fallback along with @Roles itself.
    const legacy = required
      ? undefined
      : this.reflector.getAllAndOverride<PracticeRole[] | undefined>(ROLES_KEY, [
          context.getHandler(),
          context.getClass(),
        ]);

    if ((!required || required.length === 0) && (!legacy || legacy.length === 0)) return true;
```

3. The profile read gains the grants — change its `select` to
   `{ role: true, status: true, permissions: true }`.
4. After the status check, replace the role-membership test and the tail:

```ts
    const grants = profile.permissions ?? [];
    if (required && required.length) {
      const held = effectivePermissions(profile.role, grants);
      if (!required.some((p) => held.has(p))) {
        throw new ForbiddenException('You do not have permission to do this.');
      }
    } else if (legacy && !legacy.includes(profile.role as PracticeRole)) {
      throw new ForbiddenException('Your role does not have access to this resource');
    }

    req.user.role = profile.role;
    req.user.permissions = grants;
    return true;
```

5. Update the class doc comment: it enforces permissions now; the `@Roles`
   fallback exists only until the migration completes.

- [ ] **Step 4: Run the tests and the whole API suite**

Run: `cd apps/api && npx vitest run src/common && npx vitest run 2>&1 | tail -3`
Expected: new guard tests PASS; everything else unchanged (no route uses
`@Permissions` yet).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/roles.guard.ts apps/api/src/common/roles.guard.spec.ts
git commit -m "The guard now speaks permissions, with one release of overlap for roles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Migrate every route (mechanical)

**Files (decorator swap only):** the 15 controllers listed by
`grep -rln "@Roles(\|@AnyAuthenticated()" apps/api/src/modules | grep -v spec`
— tenant, auth, consult, notes, hours, billing, discount, intake, assessments,
calendar, invites, notifications, sending-domain, privacy, requests.

**The mapping — apply exactly:**

| find | replace with |
|---|---|
| `@Roles(...PRACTICE_ADMIN)` | `@Permissions('practice.admin')` |
| `@Roles(...CLINICAL)` | `@Permissions('clinical.record')` |
| `@Roles(...STAFF)` | `@Permissions('practice.staff')` |
| `@Roles(...FRONT_DESK)` | `@Permissions('payments.desk')` |
| `@Roles('OWNER')` | `@Permissions('practice.owner')` |
| `@AnyAuthenticated()` | `@Permissions('any.authenticated')` |

- [ ] **Step 1: Run the swap**

```bash
cd apps/api/src/modules
for f in $(grep -rln "@Roles(\|@AnyAuthenticated()" . | grep -v spec); do
  python3 - "$f" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
s = s.replace("@Roles(...PRACTICE_ADMIN)", "@Permissions('practice.admin')")
s = s.replace("@Roles(...CLINICAL)", "@Permissions('clinical.record')")
s = s.replace("@Roles(...STAFF)", "@Permissions('practice.staff')")
s = s.replace("@Roles(...FRONT_DESK)", "@Permissions('payments.desk')")
s = s.replace("@Roles('OWNER')", "@Permissions('practice.owner')")
s = s.replace("@AnyAuthenticated()", "@Permissions('any.authenticated')")
open(p, 'w').write(s)
EOF
done
```

Then, in every touched controller: add
`import { Permissions } from '../../common/permissions';`
(`'../../../common/permissions'` in `notifications/sending-domain/`), and trim
the `common/roles` import to the names still used there (usually just
`AllowPlatformAdmin`, or nothing).

- [ ] **Step 2: Verify the counts match the old inventory**

```bash
grep -rc "@Permissions(" apps/api/src/modules --include="*.controller.ts" | awk -F: '{s+=$2} END {print s}'   # expect 109
grep -rn "@Permissions('practice.admin')" apps/api/src/modules | wc -l      # 33
grep -rn "@Permissions('clinical.record')" apps/api/src/modules | wc -l     # 27
grep -rn "@Permissions('practice.staff')" apps/api/src/modules | wc -l      # 16
grep -rn "@Permissions('payments.desk')" apps/api/src/modules | wc -l       # 2
grep -rn "@Permissions('practice.owner')" apps/api/src/modules | wc -l      # 1
grep -rn "@Permissions('any.authenticated')" apps/api/src/modules | wc -l   # 26
grep -rn "@Roles(\|@AnyAuthenticated()" apps/api/src/modules | grep -v spec  # no output
```

If a count is off, list the leftovers with
`grep -rn "@Roles(" apps/api/src/modules | grep -v spec` and map each by hand
to the group whose role list it matches exactly.

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (Do not run the full suite yet — `roles.spec.ts` reads
`@Roles` metadata and will fail until Task 4 updates it. Tasks 3 and 4 land as
one commit.)

- [ ] **Step 4: No commit yet — Task 4 Step 5 commits the pair.**

### Task 4: The rule test follows; the old decorators go

**Files:**
- Modify: `apps/api/src/test-support/routes.ts`
- Modify: `apps/api/src/roles.spec.ts`
- Modify: `apps/api/src/client-surface.spec.ts`
- Modify: `apps/api/src/common/roles.ts` (delete `Roles`, `ROLES_KEY`, `AnyAuthenticated`)
- Modify: `apps/api/src/common/roles.guard.ts` (delete the legacy fallback)

**Interfaces:**
- Produces: `Route.permissions: Permission[]` and `Route.hasPermissions: boolean`;
  `roles`/`hasRoles` stay, recomputed from the permission map, so
  `client-surface.spec.ts` keeps working; `rolesFor(permission)` exported.

- [ ] **Step 1: Update the route parser**

In `apps/api/src/test-support/routes.ts`:

1. Imports: drop `CLINICAL, FRONT_DESK, PRACTICE_ADMIN, STAFF` from the
   `../common/roles` import (keep `PRACTICE_ROLES`, `PracticeRole`); add
   `import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '../common/permissions';`
2. Delete `ROLE_SETS` and `rolesFrom`. Add:

```ts
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

/** The roles a permission key admits — used only by the surface tests. */
export function rolesFor(permission: Permission): PracticeRole[] {
  return (PRACTICE_ROLES as readonly string[]).filter((r) =>
    (ROLE_PERMISSIONS[r as PracticeRole] as readonly string[]).includes(permission),
  ) as PracticeRole[];
}
```

3. `Route` gains `permissions: Permission[]` and `hasPermissions: boolean`.
   Where the parser sets `hasRoles`/`roles`, set:

```ts
        permissions: permissionsFrom(deco),
        hasPermissions: /@Permissions\(/.test(deco),
```

   and after building the route object, populate the legacy fields:

```ts
      route.roles = route.permissions.length
        ? [...new Set(route.permissions.flatMap(rolesFor))].sort() as PracticeRole[]
        : rolesFromLegacy(deco);
```

   Keep the old `rolesFrom` under the name `rolesFromLegacy` solely for the
   window where a route might still carry `@Roles`; it is deleted together
   with `@Roles` at the end of this task — so instead: since Task 3 removed
   every `@Roles`, do NOT keep a legacy path. Set
   `roles: [...new Set(permissions.flatMap(rolesFor))]` and
   `hasRoles: hasPermissions`.

- [ ] **Step 2: Update the guard specs' wording, not their logic**

`apps/api/src/roles.spec.ts`:
- "every authenticated route declares its roles" → read `r.hasPermissions`;
  message: `Add @Permissions(...) or, if clients genuinely belong there, @Permissions('any.authenticated').`
- "routes behind a role decorator also carry RolesGuard" → regex
  `/@Permissions\(/` instead of `/@Roles\(|@AnyAuthenticated\(\)/`.
- "clinical routes exclude receptionists and clients" → assert each listed
  route's `permissions` includes `'clinical.record'`.

`apps/api/src/client-surface.spec.ts`: no logic change (it consumes
`roles`/`hasRoles`, which are recomputed). Run it; fix only failure messages.

- [ ] **Step 3: Delete the old mechanism**

- `apps/api/src/common/roles.ts`: delete `ROLES_KEY`, `Roles`,
  `AnyAuthenticated`. Keep `PRACTICE_ROLES`, `PracticeRole`, the four group
  arrays (`ROLE_PERMISSIONS` and the parser use them), `PLATFORM_ADMIN_KEY`
  and `AllowPlatformAdmin`.
- `apps/api/src/common/roles.guard.ts`: delete the `legacy` fallback branch
  and the `ROLES_KEY` import; `required` alone decides. Update the doc comment.
- Fix any import fallout: `grep -rn "ROLES_KEY\|@Roles(\|AnyAuthenticated" apps/api/src | grep -v spec` → no output.

- [ ] **Step 4: Run everything**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json && npx vitest run 2>&1 | tail -4`
Expected: PASS. Any route without `@Permissions` fails `roles.spec` — back to
Task 3's leftovers grep.

- [ ] **Step 5: Commit Tasks 3+4 together**

```bash
git add apps/api/src
git commit -m "Every route now asks for a permission; the role decorators are gone

The map reproduces the old groups exactly, so this changes how access is
named, not who has it. The guard test enforces @Permissions on every
authenticated route, as @Roles did.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Grants API — staff rows, the grant endpoint, the session payload

**Files:**
- Modify: `apps/api/src/modules/tenant/tenant.service.ts`
- Modify: `apps/api/src/modules/tenant/tenant.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts` (`practiceProfile`)
- Test: `apps/api/src/modules/tenant/staff-permissions.spec.ts`

**Interfaces:**
- Produces:
  - `TenantService.updateStaffPermissions(tenantId: bigint, actorProfileId: bigint, targetProfileId: bigint, permissions: unknown): Promise<{ id: string; permissions: string[] }>`
  - `getClinicStaff` member rows gain `permissions: string[]`.
  - `practiceProfile()` responses gain `permissions: string[]` — the effective
    set, so the app never recomputes the map.

- [ ] **Step 1: Write the failing test**

`apps/api/src/modules/tenant/staff-permissions.spec.ts`:

```ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TenantService } from './tenant.service';

const TENANT = 1n;
const OWNER = 5n;
const TARGET = { id: 6n, role: 'THERAPIST', status: 'active', permissions: [] };

function make(over: { actor?: any; target?: any } = {}) {
  const actor = over.actor ?? { id: OWNER, role: 'OWNER' };
  const target = over.target === undefined ? TARGET : over.target;
  const prisma: any = {
    profile: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.id === OWNER) return actor;
        if (target && where.id === target.id && where.role?.not !== 'CLIENT') return target;
        return null;
      }),
      update: vi.fn(async ({ data }: any) => ({ ...target, ...data })),
    },
  };
  return { prisma, service: new TenantService(prisma, { sendEmail: vi.fn() } as any) };
}

describe('granting permissions', () => {
  it('stores a valid grant list, sorted and deduped', async () => {
    const { service, prisma } = make();
    const res = await service.updateStaffPermissions(TENANT, OWNER, 6n, ['sessions.edit', 'payments.desk', 'sessions.edit']);
    expect(prisma.profile.update.mock.calls[0][0].data.permissions).toEqual(['payments.desk', 'sessions.edit']);
    expect(res.permissions).toEqual(['payments.desk', 'sessions.edit']);
  });
  it('refuses keys outside the catalog', async () => {
    const { service } = make();
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, ['made.up'])).rejects.toBeInstanceOf(BadRequestException);
  });
  it('refuses the structural keys by name', async () => {
    const { service } = make();
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, ['practice.owner'])).rejects.toThrow(/cannot be granted/i);
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, ['staff.manage'])).rejects.toThrow(/cannot be granted/i);
  });
  it('will not touch another practice, a client, or a missing member', async () => {
    const { service, prisma } = make({ target: null });
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, [])).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });
  it('leaves the owner alone', async () => {
    const { service } = make({ target: { id: 7n, role: 'OWNER', status: 'active', permissions: [] } });
    await expect(service.updateStaffPermissions(TENANT, OWNER, 7n, ['sessions.edit'])).rejects.toBeInstanceOf(BadRequestException);
  });
  it('a non-admin actor is refused', async () => {
    const { service } = make({ actor: { id: OWNER, role: 'THERAPIST' } });
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, [])).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('refuses a non-array body', async () => {
    const { service } = make();
    await expect(service.updateStaffPermissions(TENANT, OWNER, 6n, 'sessions.edit')).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd apps/api && npx vitest run src/modules/tenant/staff-permissions.spec.ts`
Expected: FAIL, `updateStaffPermissions is not a function`.

- [ ] **Step 3: Implement**

`apps/api/src/modules/tenant/tenant.service.ts` — after `updateStaffRole`:

```ts
  /**
   * Per-person permission grants. The role still decides the baseline; this is
   * the exception list. Keys outside the grantable catalog are refused, and an
   * owner is refused: they already hold everything, and granting them a list
   * would read as a restriction.
   */
  async updateStaffPermissions(
    tenantId: bigint,
    actorProfileId: bigint,
    targetProfileId: bigint,
    permissions: unknown,
  ) {
    const actor = await this.prisma.profile.findFirst({
      where: { id: actorProfileId, tenantId },
      select: { role: true },
    });
    if (!actor || !['OWNER', 'ADMIN'].includes(actor.role)) {
      throw new ForbiddenException('Only a practice admin can change permissions');
    }
    const target = await this.prisma.profile.findFirst({
      where: { id: targetProfileId, tenantId, role: { not: 'CLIENT' } },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('Staff member not found');
    if (target.role === 'OWNER') throw new BadRequestException('The owner already holds every permission.');

    if (!Array.isArray(permissions) || permissions.some((p) => typeof p !== 'string')) {
      throw new BadRequestException('Send the permissions as a list.');
    }
    for (const p of permissions) {
      if (!(GRANTABLE as readonly string[]).includes(p)) {
        throw new BadRequestException(
          (PERMISSIONS as readonly string[]).includes(p)
            ? `“${p}” cannot be granted — it comes with the role.`
            : `“${p}” is not a permission.`,
        );
      }
    }
    const clean = [...new Set(permissions as string[])].sort();
    const updated = await this.prisma.profile.update({
      where: { id: target.id },
      data: { permissions: clean },
      select: { id: true, permissions: true },
    });
    return { id: updated.id.toString(), permissions: updated.permissions };
  }
```

Imports at the top of the service:
`import { GRANTABLE, PERMISSIONS } from '../../common/permissions';`
(`ForbiddenException` is already imported there — check).

`tenant.controller.ts` — after the role route:

```ts
  @Permissions('staff.manage')
  @Patch('staff/:profileId/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set a staff member’s extra permissions' })
  updateStaffPermissions(
    @Req() req: any,
    @Param('profileId') profileId: string,
    @Body() dto: { permissions?: unknown },
  ) {
    if (!/^\d+$/.test(profileId)) throw new NotFoundException('Staff member not found');
    return this.tenantService.updateStaffPermissions(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      BigInt(profileId),
      dto?.permissions,
    );
  }
```

Add the `Permissions` import to the controller (it now imports from
`common/permissions`).

`getClinicStaff`: in the member-row map add
`permissions: s.permissions ?? [],` (the `findMany` returns full rows; if it
uses a `select`, add `permissions: true`).

`apps/api/src/modules/auth/auth.service.ts` — `practiceProfile()`:
add `permissions: string[] | null;` to the parameter type and to the returned
object:

```ts
      // The effective set, computed here once: the app shows and hides with
      // it, and the guard still enforces independently on every call.
      permissions: [...effectivePermissions(profile.role, profile.permissions ?? [])],
```

with `import { effectivePermissions } from '../../common/permissions';`.
Then run the typecheck — every `practiceProfile(...)` call site whose profile
select lacks `permissions` will error; add `permissions: true` to those
selects (login, status, refresh, invite-claim, register paths).

- [ ] **Step 4: Run the suite and typecheck**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json && npx vitest run 2>&1 | tail -3`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tenant apps/api/src/modules/auth
git commit -m "Give staff rows and the session payload their permissions

PATCH staff/:profileId/permissions stores the grant list; the signed-in
profile now carries its effective permissions, so the app can show and
hide without re-implementing the map.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: The permissions editor on the team page

**Files:**
- Create: `apps/app/src/components/team/PermissionsDialog.tsx`
- Modify: `apps/app/src/pages/practice/settings/TeamSettingsPage.tsx`
- Modify: `apps/app/src/App.tsx` (`StaffMember` gains `permissions?: string[]`)
- Test: `apps/app/src/components/team/__tests__/PermissionsDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../test/renderWithApp';

const apiPatch = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: (...a: unknown[]) => apiPatch(...a), delete: vi.fn() },
}));

const { PermissionsDialog } = await import('../PermissionsDialog');

const MEMBER = { id: '6', name: 'Segun Ade', email: 'segun@practice.ng', role: 'THERAPIST', permissions: ['sessions.edit'] };

afterEach(cleanup);
beforeEach(() => apiPatch.mockReset());

describe('PermissionsDialog', () => {
  it('ticks what the member already holds and marks what the role gives anyway', () => {
    renderWithApp(<PermissionsDialog member={MEMBER} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByRole('checkbox', { name: /Move or cancel any session/ }).hasAttribute('checked')).toBe(true);
    const clinical = screen.getByRole('checkbox', { name: /Clinical records/ });
    expect(clinical.getAttribute('aria-disabled')).toBe('true');
    expect(clinical.checked).toBe(true);
  });
  it('saves the ticked list', async () => {
    apiPatch.mockResolvedValue({ id: '6', permissions: ['payments.desk'] });
    const onSaved = vi.fn();
    renderWithApp(<PermissionsDialog member={{ ...MEMBER, permissions: [] }} onClose={() => {}} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Front-desk money/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save permissions' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/tenant/staff/6/permissions', { permissions: ['payments.desk'] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
  it('shows the server’s reason when saving fails', async () => {
    apiPatch.mockRejectedValue(new Error('“practice.owner” cannot be granted — it comes with the role.'));
    renderWithApp(<PermissionsDialog member={MEMBER} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save permissions' }));
    await waitFor(() => expect(screen.getByText(/cannot be granted/)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** (import cannot be resolved)

Run: `cd apps/app && npx vitest run src/components/team`

- [ ] **Step 3: Implement**

`apps/app/src/components/team/PermissionsDialog.tsx`:

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/apiClient';

type Permission =
  | 'practice.admin' | 'practice.staff' | 'clinical.record' | 'payments.desk'
  | 'sessions.view-all' | 'sessions.edit' | 'sessions.summary' | 'staff.manage';

const CATALOG: { key: Permission; label: string; hint: string; group: string }[] = [
  { group: 'Sessions', key: 'sessions.view-all', label: 'Every practitioner’s diary', hint: 'See all sessions, not only your own.' },
  { group: 'Sessions', key: 'sessions.edit', label: 'Move or cancel any session', hint: 'Reschedule, confirm or cancel on the practice’s behalf.' },
  { group: 'Clinical', key: 'clinical.record', label: 'Clinical records', hint: 'SOAP notes, assessments, session prep.' },
  { group: 'Clinical', key: 'sessions.summary', label: 'Session summaries', hint: 'Internal summary and the client recap.' },
  { group: 'Money', key: 'payments.desk', label: 'Front-desk money', hint: 'Mark transfers paid; see payout views.' },
  { group: 'Practice', key: 'practice.staff', label: 'Workspace access', hint: 'Sign in to the staff area at all.' },
  { group: 'Practice', key: 'practice.admin', label: 'Practice settings', hint: 'Staff, billing, branding, services.' },
  { group: 'Practice', key: 'staff.manage', label: 'Change roles and permissions', hint: 'Use this very editor on other people.' },
];

const ROLE_BASE: Record<string, Permission[]> = {
  OWNER: CATALOG.map((c) => c.key),
  ADMIN: ['practice.admin', 'practice.staff', 'clinical.record', 'payments.desk', 'sessions.view-all', 'sessions.edit', 'sessions.summary', 'staff.manage'],
  THERAPIST: ['practice.staff', 'clinical.record', 'sessions.summary'],
  RECEPTIONIST: ['practice.staff', 'payments.desk', 'sessions.view-all', 'sessions.edit'],
  CLIENT: [],
};

export function PermissionsDialog({
  member,
  onClose,
  onSaved,
}: {
  member: { id: string; name: string; email: string; role: string; permissions?: string[] };
  onClose: () => void;
  onSaved: (permissions: string[]) => void;
}) {
  const base = new Set<string>(ROLE_BASE[member.role] ?? []);
  const [grants, setGrants] = useState<Set<string>>(new Set(member.permissions ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = [...new Set(CATALOG.map((c) => c.group))];

  function toggle(key: string) {
    setGrants((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const list = [...grants].sort();
      await api.patch(`/v1/tenant/staff/${member.id}/permissions`, { permissions: list });
      onSaved(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the permissions');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4" role="dialog" aria-modal="true" aria-label={`Permissions for ${member.name}`}>
      <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">Permissions — {member.name}</h2>
            <p className="text-[12px] text-[#64748B]">
              Ticks here add to what the <span className="font-bold">{member.role.toLowerCase()}</span> role already gives. Nothing removes it.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 inline-flex items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {groups.map((g) => (
          <fieldset key={g} className="space-y-1.5">
            <legend className="text-[10.5px] font-black tracking-[0.14em] uppercase text-[#64748B] mb-1">{g}</legend>
            {CATALOG.filter((c) => c.group === g).map((c) => {
              const fromRole = base.has(c.key);
              return (
                <label key={c.key} className={`flex items-start gap-2.5 p-2.5 rounded-[12px] border ${fromRole ? 'border-[#E2E8F0] bg-[#F8FAFC] opacity-70' : 'border-[#E2E8F0] cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    aria-label={c.label}
                    checked={fromRole || grants.has(c.key)}
                    disabled={fromRole}
                    aria-disabled={fromRole}
                    onChange={() => toggle(c.key)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-bold text-[#0F172A]">
                      {c.label}
                      {fromRole ? <span className="ml-1.5 text-[10px] font-black uppercase text-[#64748B]">from role</span> : null}
                    </span>
                    <span className="block text-[11.5px] text-[#64748B]">{c.hint}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}

        {error ? <p className="text-[12px] font-medium text-rose-700">{error}</p> : null}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="w-full h-[42px] rounded-[12px] bg-[#0F3A53] text-white text-[13px] font-bold cursor-pointer disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save permissions'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire it into the team page**

1. `apps/app/src/App.tsx` — `StaffMember` gains `permissions?: string[];`.
2. `TeamSettingsPage.tsx`:
   - `import { PermissionsDialog } from '../../../components/team/PermissionsDialog';`
     and `import { useAuth } from '../../../context/AuthContext';`
   - `const { profile } = useAuth();`
   - `const [permissionsFor, setPermissionsFor] = useState<StaffMember | null>(null);`
   - In the row menu, non-pending branch, before the deactivate button:

```tsx
{profile?.permissions?.includes('staff.manage') && m.role !== 'OWNER' ? (
  <button
    onClick={() => { setPermissionsFor(m); setActiveMenuId(null); }}
    className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 text-left"
  >
    Permissions…
  </button>
) : null}
```

   - Before the closing `</Page>`:

```tsx
{permissionsFor ? (
  <PermissionsDialog
    member={permissionsFor}
    onClose={() => setPermissionsFor(null)}
    onSaved={() => {
      setPermissionsFor(null);
      void onRefresh();
      toast.success('Permissions saved');
    }}
  />
) : null}
```

3. `AuthContext.tsx` — `AuthProfile` gains `permissions?: string[];`.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd apps/app && npx vitest run src/components/team && npx tsc --noEmit && npx vitest run 2>&1 | tail -3`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/components/team apps/app/src/pages/practice/settings/TeamSettingsPage.tsx apps/app/src/App.tsx apps/app/src/context/AuthContext.tsx
git commit -m "Tick a person’s extra permissions from the team page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Part B: sessions — the API

### Task 7: Summary columns

**Files:**
- Modify: `prisma/schema.prisma` (`ConsultBooking`, after `videoRoomName`)
- Create: `prisma/migrations/20260928150000_session_summaries/migration.sql`

- [ ] **Step 1: Schema + migration**

```prisma
  /// What happened, for staff. Seen by clinical roles only.
  internalSummary     String?   @db.Text
  /// The recap written for the client; emailed on request, never automatically.
  clientRecap         String?   @db.Text
  clientRecapSentAt   DateTime?
```

```sql
ALTER TABLE "ConsultBooking"
  ADD COLUMN "internalSummary" TEXT,
  ADD COLUMN "clientRecap" TEXT,
  ADD COLUMN "clientRecapSentAt" TIMESTAMP(3);
```

Run: `npx prisma migrate deploy --schema prisma/schema.prisma && npx prisma generate --schema prisma/schema.prisma`
Expected: "1 migration applied", "Generated Prisma Client".

- [ ] **Step 2: Commit**

```bash
git add prisma
git commit -m "Room on the booking for a summary and a client recap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: SessionDirectoryService — the list and the detail

**Files:**
- Create: `apps/api/src/modules/consult/session-directory.service.ts`
- Test: `apps/api/src/modules/consult/session-directory.spec.ts`

**Interfaces:**
- Produces (used by Tasks 9–12):
  - `class SessionDirectoryService` with constructor `(prisma: PrismaService, notifications: NotificationService)`
  - `interface SessionActor { profileId: bigint; viewAll: boolean; clinical?: boolean; desk?: boolean }`
  - `listSessions(tenantId, actor, q: { status?: 'upcoming'|'past'|'all'; providerProfileId?: bigint; search?: string }): Promise<SessionRow[]>`
  - `getSession(tenantId, actor, bookingId): Promise<SessionDetail>`
  - `SessionRow = { id: string; startsAt: string; endsAt: string; status: string; paymentMethod: string; amountKobo: string | null; holdExpiresAt: string | null; bookedBy: string | null; client: { id: string; name: string }; serviceTitle: string; provider: { id: string; name: string }; channel: string }`
  - `SessionDetail = SessionRow & { clientEmail: string; clientPhone: string | null; videoRoomLink: string | null; note: { id: string; status: 'DRAFT' | 'COMPLETED' } | null; internalSummary: string | null; clientRecap: string | null; clientRecapSentAt: string | null; can: { edit: boolean; summary: boolean; markPaid: boolean } }`

- [ ] **Step 1: Write the failing tests**

`apps/api/src/modules/consult/session-directory.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SessionDirectoryService } from './session-directory.service';

const TENANT = 1n;
const ACTOR = 6n;
const DAY = 86_400_000;

function make(over: Record<string, any> = {}) {
  const booking = {
    id: 900n,
    status: 'CONFIRMED',
    paymentMethod: 'PAYSTACK',
    amountKobo: 3_500_000n,
    holdExpiresAt: null,
    createdByProfileId: null,
    videoRoomName: 'room-9',
    internalSummary: null,
    clientRecap: null,
    clientRecapSentAt: null,
    client: { id: 40n, firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com', phone: '0801' },
    service: { title: 'Individual Therapy' },
    availability: {
      startsAt: new Date(Date.now() + 2 * DAY),
      endsAt: new Date(Date.now() + 2 * DAY + 3_600_000),
      providerProfileId: ACTOR,
      channel: 'VIDEO',
      therapist: { profile: { firstName: 'Segun', lastName: 'Ade' } },
    },
    clinicalNotes: over.note === undefined ? [] : [over.note],
    ...(over.booking ?? {}),
  };
  const prisma: any = {
    consultBooking: {
      findMany: vi.fn().mockResolvedValue(over.rows ?? [booking]),
      findFirst: vi.fn().mockResolvedValue(over.found === null ? null : booking),
    },
    profile: { findMany: vi.fn().mockResolvedValue(over.creators ?? []), findFirst: vi.fn().mockResolvedValue({ firstName: 'Frank', lastName: 'Desk' }) },
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  return { prisma, notifications, service: new SessionDirectoryService(prisma, notifications), booking };
}

const VIEWER = { profileId: ACTOR, viewAll: false };
const DESK = { profileId: 9n, viewAll: true, clinical: false, desk: true };

describe('listSessions', () => {
  it('forces a non-view-all actor onto their own diary', async () => {
    const { service, prisma } = make();
    await service.listSessions(TENANT, VIEWER, {});
    expect(prisma.consultBooking.findMany.mock.calls[0][0].where.availability.providerProfileId).toBe(ACTOR);
  });
  it('lets a view-all actor filter by practitioner, or see everyone', async () => {
    const { service, prisma } = make();
    await service.listSessions(TENANT, DESK, {});
    expect(prisma.consultBooking.findMany.mock.calls[0][0].where.availability).not.toHaveProperty('providerProfileId');
    await service.listSessions(TENANT, DESK, { providerProfileId: 11n });
    expect(prisma.consultBooking.findMany.mock.calls[1][0].where.availability.providerProfileId).toBe(11n);
  });
  it('upcoming excludes the past and the cancelled', async () => {
    const { service, prisma } = make();
    await service.listSessions(TENANT, DESK, { status: 'upcoming' });
    const where = prisma.consultBooking.findMany.mock.calls[0][0].where;
    expect(where.availability.startsAt.gte).toBeInstanceOf(Date);
    expect(where.status).toEqual({ not: 'CANCELLED' });
  });
  it('searches the client and the service, case-insensitively', async () => {
    const { service, prisma } = make();
    await service.listSessions(TENANT, DESK, { search: ' Ada ' });
    const where = prisma.consultBooking.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { client: { firstName: { contains: 'ada', mode: 'insensitive' } } },
      { client: { lastName: { contains: 'ada', mode: 'insensitive' } } },
      { client: { email: { contains: 'ada', mode: 'insensitive' } } },
      { service: { title: { contains: 'ada', mode: 'insensitive' } } },
    ]);
  });
  it('names who made a staff booking', async () => {
    const { service } = make({ booking: { createdByProfileId: 9n } });
    const rows = await service.listSessions(TENANT, DESK, {});
    expect(rows[0].bookedBy).toBe('Frank Desk');
  });
});

describe('getSession', () => {
  it('is not found for another practitioner’s session, same as a stranger', async () => {
    const { service } = make({ booking: { availability: { startsAt: new Date(), endsAt: new Date(), providerProfileId: 77n, channel: 'VIDEO', therapist: { profile: {} } } } });
    await expect(service.getSession(TENANT, VIEWER, 900n)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('the desk can edit and mark paid but not read the summary', async () => {
    const { service } = make({ note: { id: 3n, isLocked: true } });
    const d = await service.getSession(TENANT, DESK, 900n);
    expect(d.can).toEqual({ edit: true, summary: false, markPaid: true });
    expect(d.note).toEqual({ id: '3', status: 'COMPLETED' });
  });
  it('a clinical actor on their own session gets summary rights, not edit', async () => {
    const { service } = make();
    const d = await service.getSession(TENANT, { profileId: ACTOR, viewAll: false, clinical: true, desk: false }, 900n);
    expect(d.can).toEqual({ edit: false, summary: true, markPaid: false });
  });
  it('builds the video link from the room name', async () => {
    const { service } = make();
    const d = await service.getSession(TENANT, DESK, 900n);
    expect(d.videoRoomLink).toBe('https://meet.jit.si/room-9');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail** (import cannot be resolved)

Run: `cd apps/api && npx vitest run src/modules/consult/session-directory.spec.ts`

- [ ] **Step 3: Implement**

`apps/api/src/modules/consult/session-directory.service.ts`:

```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { chargedKobo } from '../../common/revenue';
import { tenantWebOrigin } from '../../common/origins';

export interface SessionActor {
  profileId: bigint;
  viewAll: boolean;
  clinical?: boolean;
  desk?: boolean;
}

const name = (p: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback = 'Client') =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || fallback;

const roomLink = (roomName: string | null) =>
  !roomName ? null : roomName.startsWith('http') ? roomName : `https://meet.jit.si/${roomName}`;

/**
 * The practice's session register and the single-session view: the same rows
 * the schedule feed shows, but scoped by permission rather than by one
 * practitioner's diary, and joined with what the session page needs.
 */
@Injectable()
export class SessionDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private include() {
    return {
      client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      service: { select: { title: true } },
      availability: { include: { therapist: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      clinicalNotes: { select: { id: true, isLocked: true }, take: 1, orderBy: { createdAt: 'desc' as const } },
    };
  }

  private shape(b: any, bookedBy: string | null) {
    return {
      id: b.id.toString(),
      startsAt: b.availability.startsAt.toISOString(),
      endsAt: b.availability.endsAt.toISOString(),
      status: b.status as string,
      paymentMethod: b.paymentMethod as string,
      amountKobo: b.amountKobo !== null && b.amountKobo !== undefined ? String(b.amountKobo) : null,
      holdExpiresAt: b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
      bookedBy,
      client: { id: b.client.id.toString(), name: name(b.client) },
      serviceTitle: b.service.title,
      provider: {
        id: b.availability.therapist?.profileId?.toString?.() ?? '',
        name: name(b.availability.therapist?.profile, 'Practitioner'),
      },
      channel: b.availability.channel as string,
    };
  }

  private async bookedBy(tenantId: bigint, createdByProfileId: bigint | null): Promise<string | null> {
    if (!createdByProfileId) return null;
    const creator = await this.prisma.profile.findFirst({
      where: { id: createdByProfileId, tenantId },
      select: { firstName: true, lastName: true },
    });
    return name(creator, 'Staff');
  }

  async listSessions(
    tenantId: bigint,
    actor: SessionActor,
    q: { status?: 'upcoming' | 'past' | 'all'; providerProfileId?: bigint; search?: string } = {},
  ) {
    const now = new Date();
    const where: any = { tenantId };
    where.availability = actor.viewAll
      ? q.providerProfileId ? { providerProfileId: q.providerProfileId } : {}
      : { providerProfileId: actor.profileId };
    if (q.status === 'upcoming') {
      where.availability.startsAt = { gte: now };
      where.status = { not: 'CANCELLED' };
    } else if (q.status === 'past') {
      where.availability.startsAt = { lt: now };
    }
    const s = q.search?.trim().toLowerCase();
    if (s) {
      where.OR = [
        { client: { firstName: { contains: s, mode: 'insensitive' } } },
        { client: { lastName: { contains: s, mode: 'insensitive' } } },
        { client: { email: { contains: s, mode: 'insensitive' } } },
        { service: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.consultBooking.findMany({
      where,
      include: this.include(),
      orderBy: { availability: { startsAt: q.status === 'past' ? 'desc' : 'asc' } },
      take: 500,
    });

    const out = [];
    for (const b of rows) out.push(this.shape(b, await this.bookedBy(tenantId, b.createdByProfileId)));
    return out;
  }

  async getSession(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      include: this.include(),
    });
    if (!b) throw new NotFoundException('Session not found');
    const note = b.clinicalNotes[0];
    return {
      ...this.shape(b, await this.bookedBy(tenantId, b.createdByProfileId)),
      clientEmail: b.client.email,
      clientPhone: b.client.phone,
      videoRoomLink: b.availability.channel === 'VIDEO' ? roomLink(b.videoRoomName) : null,
      note: note ? { id: note.id.toString(), status: note.isLocked ? 'COMPLETED' : 'DRAFT' } : null,
      internalSummary: b.internalSummary,
      clientRecap: b.clientRecap,
      clientRecapSentAt: b.clientRecapSentAt ? b.clientRecapSentAt.toISOString() : null,
      can: {
        edit: actor.viewAll === true,
        summary: actor.clinical === true,
        markPaid: actor.desk === true,
      },
    };
  }
}
```

Note: `provider.id` comes from `therapist.profileId` — if the mocked rows in the
tests lack it, the field is `''`; the tests only assert `provider.name`. Keep
the include as written (availability → therapist → profile); add
`therapist: { select: { profileId: true, profile: ... } }` if you prefer the id
populated — the tests do not assert it.

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd apps/api && npx vitest run src/modules/consult/session-directory.spec.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/consult
git commit -m "The session register: everyone’s sessions, or only your own, by permission

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Staff actions — status, reschedule, cancel

**Files:**
- Modify: `apps/api/src/modules/consult/session-directory.service.ts`
- Test: append to `session-directory.spec.ts`

**Interfaces:**
- Produces:
  - `setStatus(tenantId, actor: SessionActor, bookingId, status: 'CONFIRMED'|'COMPLETED'|'CANCELLED')` — view-all may change any session; otherwise only your own, and only to `COMPLETED`. Cancelling releases the slot.
  - `rescheduleByStaff(tenantId, actor: SessionActor, bookingId, newAvailabilityId)` — view-all only; same provider, open, future, service-compatible; the old slot returns to the pool.

- [ ] **Step 1: Append the failing tests**

```ts
describe('setStatus', () => {
  it('a therapist may complete their own session', async () => {
    const { service, prisma } = make();
    prisma.consultBooking.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await service.setStatus(TENANT, VIEWER, 900n, 'COMPLETED');
    expect(prisma.consultBooking.updateMany.mock.calls[0][0].where).toMatchObject({ id: 900n, tenantId: TENANT });
  });
  it('a therapist may not touch another practitioner’s session', async () => {
    const { service } = make({ booking: { availability: { startsAt: new Date(), endsAt: new Date(), providerProfileId: 77n, channel: 'VIDEO', therapist: { profile: {} } } } });
    await expect(service.setStatus(TENANT, VIEWER, 900n, 'COMPLETED')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('a therapist may not confirm or cancel — that is the desk’s', async () => {
    const { service } = make();
    await expect(service.setStatus(TENANT, VIEWER, 900n, 'CANCELLED')).rejects.toThrow(/only mark your own sessions complete/i);
  });
  it('cancelling returns the time to the pool', async () => {
    const { service, prisma } = make();
    prisma.consultBooking.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    prisma.consultAvailability = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    await service.setStatus(TENANT, DESK, 900n, 'CANCELLED');
    expect(prisma.consultAvailability.updateMany).toHaveBeenCalled();
  });
});

describe('rescheduleByStaff', () => {
  const slot = (over: Record<string, any> = {}) => ({
    id: 301n, tenantId: TENANT, providerProfileId: ACTOR, serviceId: null,
    startsAt: new Date(Date.now() + 3 * DAY), isActive: true, ...over,
  });
  function tx(over: Record<string, any> = {}) {
    return {
      consultBooking: {
        findFirst: vi.fn().mockResolvedValue({ id: 900n, tenantId: TENANT, status: 'CONFIRMED', availabilityId: 300n, serviceId: 20n, ...(over.booking ?? {}) }),
        update: vi.fn(),
      },
      consultAvailability: {
        findFirst: vi.fn(async ({ where }: any) => (where.id === 301n ? over.slot ?? slot() : { providerProfileId: over.oldProvider ?? ACTOR })),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
  }
  it('moves the booking and returns the old slot to the pool', async () => {
    const t = tx();
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await service.rescheduleByStaff(TENANT, DESK, 900n, 301n);
    expect(t.consultAvailability.updateMany).toHaveBeenCalledWith({ where: { id: 300n, tenantId: TENANT }, data: { isActive: true } });
    expect(t.consultAvailability.update).toHaveBeenCalledWith({ where: { id: 301n }, data: { isActive: false } });
    expect(t.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { availabilityId: 301n } });
  });
  it('refuses a slot another practitioner owns', async () => {
    const t = tx({ slot: slot({ providerProfileId: 66n }) });
    const { service, prisma } = make();
    prisma.$transaction = vi.fn(async (fn: any) => fn(t));
    await expect(service.rescheduleByStaff(TENANT, DESK, 900n, 301n)).rejects.toThrow(/same practitioner/i);
    expect(t.consultBooking.update).not.toHaveBeenCalled();
  });
  it('refuses a taken slot, a past slot, or the wrong service', async () => {
    for (const bad of [slot({ isActive: false }), slot({ startsAt: new Date(Date.now() - DAY) }), slot({ serviceId: 21n })]) {
      const t = tx({ slot: bad });
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await expect(service.rescheduleByStaff(TENANT, DESK, 900n, 301n)).rejects.toThrow();
    }
  });
  it('refuses a completed or cancelled session', async () => {
    for (const status of ['COMPLETED', 'CANCELLED']) {
      const t = tx({ booking: { status } });
      const { service, prisma } = make();
      prisma.$transaction = vi.fn(async (fn: any) => fn(t));
      await expect(service.rescheduleByStaff(TENANT, DESK, 900n, 301n)).rejects.toThrow(/cannot be moved/i);
    }
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

- [ ] **Step 3: Implement** (append methods to the service)

```ts
  /** The desk moves and closes sessions; a therapist only closes their own. */
  async setStatus(
    tenantId: bigint,
    actor: SessionActor,
    bookingId: bigint,
    status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
  ) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      select: { id: true, availabilityId: true },
    });
    if (!b) throw new NotFoundException('Session not found');
    if (!actor.viewAll && status !== 'COMPLETED') {
      throw new ForbiddenException('You can only mark your own sessions complete. Ask the front desk to confirm or cancel a session.');
    }
    await this.prisma.consultBooking.updateMany({ where: { id: b.id, tenantId }, data: { status } });
    if (status === 'CANCELLED') {
      // The time goes back on the shelf, as the expiry cron does.
      await this.prisma.consultAvailability.updateMany({
        where: { id: b.availabilityId, tenantId },
        data: { isActive: true },
      });
    }
    return { id: b.id.toString(), status };
  }

  /** Staff move a session to another open slot of the same practitioner. */
  async rescheduleByStaff(tenantId: bigint, actor: SessionActor, bookingId: bigint, newAvailabilityId: bigint) {
    if (!actor.viewAll) {
      throw new ForbiddenException('Ask the front desk or a practice admin to move a session.');
    }
    return this.prisma.$transaction(async (tx: any) => {
      const b = await tx.consultBooking.findFirst({
        where: { id: bookingId, tenantId },
        select: { id: true, status: true, availabilityId: true, serviceId: true },
      });
      if (!b) throw new NotFoundException('Session not found');
      if (b.status === 'CANCELLED' || b.status === 'COMPLETED') {
        throw new BadRequestException('A cancelled or completed session cannot be moved.');
      }
      const [slot, oldSlot] = await Promise.all([
        tx.consultAvailability.findFirst({ where: { id: newAvailabilityId, tenantId } }),
        tx.consultAvailability.findFirst({ where: { id: b.availabilityId }, select: { providerProfileId: true } }),
      ]);
      if (!slot || !slot.isActive || slot.startsAt <= new Date()) {
        throw new BadRequestException('That time is no longer open. Choose another.');
      }
      if (slot.providerProfileId !== oldSlot?.providerProfileId) {
        throw new BadRequestException('Pick an open time from the same practitioner.');
      }
      if (slot.serviceId !== null && slot.serviceId !== b.serviceId) {
        throw new BadRequestException('That time is kept for a different service. Choose another.');
      }
      await tx.consultAvailability.updateMany({ where: { id: b.availabilityId, tenantId }, data: { isActive: true } });
      await tx.consultAvailability.update({ where: { id: slot.id }, data: { isActive: false } });
      await tx.consultBooking.update({ where: { id: b.id }, data: { availabilityId: slot.id } });
      return { id: b.id.toString(), startsAt: slot.startsAt.toISOString() };
    });
  }
```

- [ ] **Step 4: Run the tests and commit**

```bash
cd apps/api && npx vitest run src/modules/consult/session-directory.spec.ts
git add apps/api/src/modules/consult
git commit -m "Staff actions on a session: close your own, the desk moves or cancels any

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Summary and recap email

**Files:**
- Modify: `apps/api/src/modules/consult/session-directory.service.ts`
- Test: append to `session-directory.spec.ts`

**Interfaces:**
- Produces:
  - `setSummary(tenantId, actor, bookingId, dto: { internalSummary?: string | null; clientRecap?: string | null })` — clinical only (route guard), trims, caps at 4000 chars, `null` clears.
  - `sendRecap(tenantId, actor, bookingId)` — requires `clientRecap`; email type `bookings.session_recap`; stamps `clientRecapSentAt`; re-sends allowed (the UI shows when it was sent).

- [ ] **Step 1: Append the failing tests**

```ts
describe('summaries', () => {
  it('stores both texts, trimmed', async () => {
    const { service, prisma } = make();
    prisma.consultBooking.update = vi.fn().mockResolvedValue({ id: 900n });
    await service.setSummary(TENANT, { profileId: ACTOR, viewAll: false, clinical: true }, 900n, {
      internalSummary: '  worked on grounding  ',
      clientRecap: 'Practised the 4-7-8 breath. ',
    });
    expect(prisma.consultBooking.update.mock.calls[0][0].data).toMatchObject({
      internalSummary: 'worked on grounding',
      clientRecap: 'Practised the 4-7-8 breath.',
    });
  });
  it('refuses to send a recap that was never written', async () => {
    const { service } = make();
    await expect(service.sendRecap(TENANT, DESK, 900n)).rejects.toThrow(/Write the recap first/i);
  });
  it('emails the client and stamps the send', async () => {
    const { service, prisma, notifications } = make({ booking: { clientRecap: 'Well done this week.' } });
    prisma.consultBooking.update = vi.fn().mockResolvedValue({ id: 900n });
    prisma.tenant = { findUnique: vi.fn().mockResolvedValue({ name: 'Smith Therapy', slug: 'dr-smith', customDomain: null, customDomainStatus: null }) };
    await service.sendRecap(TENANT, { profileId: ACTOR, viewAll: false, clinical: true }, 900n);
    expect(notifications.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ada@example.com',
      type: 'bookings.session_recap',
      profileId: 40n,
    }));
    expect(prisma.consultBooking.update.mock.calls[0][0].data.clientRecapSentAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

- [ ] **Step 3: Implement**

```ts
  async setSummary(
    tenantId: bigint,
    actor: SessionActor,
    bookingId: bigint,
    dto: { internalSummary?: string | null; clientRecap?: string | null },
  ) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      select: { id: true },
    });
    if (!b) throw new NotFoundException('Session not found');
    const clean = (v: unknown) => (v === null || v === undefined ? null : String(v).trim().slice(0, 4000) || null);
    const data: Record<string, unknown> = {};
    if ('internalSummary' in dto) data.internalSummary = clean(dto.internalSummary);
    if ('clientRecap' in dto) data.clientRecap = clean(dto.clientRecap);
    await this.prisma.consultBooking.update({ where: { id: b.id }, data });
    return { id: b.id.toString() };
  }

  async sendRecap(tenantId: bigint, actor: SessionActor, bookingId: bigint) {
    const b = await this.prisma.consultBooking.findFirst({
      where: { id: bookingId, tenantId, ...(actor.viewAll ? {} : { availability: { providerProfileId: actor.profileId } }) },
      include: {
        client: { select: { id: true, email: true, firstName: true } },
        service: { select: { title: true } },
        availability: { select: { startsAt: true } },
      },
    });
    if (!b) throw new NotFoundException('Session not found');
    if (!b.clientRecap?.trim()) throw new BadRequestException('Write the recap before sending it.');
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true, customDomain: true, customDomainStatus: true },
    });
    await this.notifications.sendEmail({
      to: b.client.email,
      type: 'bookings.session_recap',
      title: `Your recap from ${b.service.title}`,
      message: `${b.client.firstName ?? 'There'}, here is the recap from your session on ${b.availability.startsAt.toDateString()}:\n\n${b.clientRecap.trim()}\n\n— ${tenant?.name ?? 'Your practice'}`,
      link: `${tenantWebOrigin(tenant as any)}/portal`,
      actionLabel: 'View my sessions',
      tenantId,
      profileId: b.client.id,
    });
    await this.prisma.consultBooking.update({ where: { id: b.id }, data: { clientRecapSentAt: new Date() } });
    return { id: b.id.toString(), sentAt: new Date().toISOString() };
  }
```

- [ ] **Step 4: Run the tests and commit**

```bash
cd apps/api && npx vitest run src/modules/consult/session-directory.spec.ts
git add apps/api/src/modules/consult
git commit -m "A summary for the file, a recap for the client, sent only when asked

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Client history and payments for staff

**Files:**
- Modify: `apps/api/src/modules/consult/session-directory.service.ts`
- Test: append to `session-directory.spec.ts`

**Interfaces:**
- Produces:
  - `clientSessions(tenantId, actor: SessionActor, clientProfileId: bigint)` — one client's sessions, newest first; no clinical text.
  - `clientPayments(tenantId, clientProfileId: bigint)` — the same rows the portal's payments tab shows.

- [ ] **Step 1: Append the failing tests**

```ts
describe('client history', () => {
  it('lists one client’s sessions newest first, scoped to the tenant', async () => {
    const { service, prisma } = make();
    await service.clientSessions(TENANT, DESK, 40n);
    const args = prisma.consultBooking.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ tenantId: TENANT, clientProfileId: 40n });
    expect(args.orderBy).toEqual({ availability: { startsAt: 'desc' } });
  });
  it('totals what the client paid and what is outstanding', async () => {
    const { service, prisma } = make();
    prisma.consultBooking.findMany = vi.fn().mockResolvedValue([
      { id: 1n, service: { title: 'A', priceKobo: 200n }, availability: { startsAt: new Date() }, amountKobo: 200n, discountCodeUsed: null, status: 'CONFIRMED', paidAt: new Date(), paymentRef: 'r1', createdAt: new Date() },
      { id: 2n, service: { title: 'B', priceKobo: 500n }, availability: { startsAt: new Date() }, amountKobo: null, discountCodeUsed: null, status: 'PENDING_PAYMENT', paidAt: null, paymentRef: null, createdAt: new Date() },
    ]);
    const out = await service.clientPayments(TENANT, 40n);
    expect(out.totalPaidKobo).toBe('200');
    expect(out.outstandingKobo).toBe('500');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

- [ ] **Step 3: Implement**

```ts
  /** One client's sessions for the client page — no clinical text. */
  async clientSessions(tenantId: bigint, actor: SessionActor, clientProfileId: bigint) {
    const rows = await this.prisma.consultBooking.findMany({
      where: { tenantId, clientProfileId },
      include: this.include(),
      orderBy: { availability: { startsAt: 'desc' } },
      take: 200,
    });
    const out = [];
    for (const b of rows) out.push(this.shape(b, await this.bookedBy(tenantId, b.createdByProfileId)));
    return out;
  }

  /** The client's billing history, for the desk: same rows the portal shows. */
  async clientPayments(tenantId: bigint, clientProfileId: bigint) {
    const bookings = await this.prisma.consultBooking.findMany({
      where: { tenantId, clientProfileId },
      include: { service: { select: { title: true, priceKobo: true } }, availability: { select: { startsAt: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const payments = bookings.map((booking: any) => ({
      bookingId: booking.id.toString(),
      serviceTitle: booking.service.title,
      sessionAt: booking.availability.startsAt.toISOString(),
      amountKobo: chargedKobo(booking).toString(),
      discountCode: booking.discountCodeUsed,
      status: booking.status,
      paidAt: booking.paidAt ? booking.paidAt.toISOString() : null,
      reference: booking.paymentRef,
      bookedAt: booking.createdAt.toISOString(),
    }));
    const paidKobo = payments.filter((p: any) => p.paidAt).reduce((t: bigint, p: any) => t + BigInt(p.amountKobo), 0n);
    const outstandingKobo = payments.filter((p: any) => p.status === 'PENDING_PAYMENT').reduce((t: bigint, p: any) => t + BigInt(p.amountKobo), 0n);
    return { payments, totalPaidKobo: paidKobo.toString(), outstandingKobo: outstandingKobo.toString() };
  }
```

- [ ] **Step 4: Run the tests and commit**

```bash
cd apps/api && npx vitest run src/modules/consult/session-directory.spec.ts
git add apps/api/src/modules/consult
git commit -m "One client's sessions and payments, for the staff client page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Routes and module wiring

**Files:**
- Modify: `apps/api/src/modules/consult/consult.module.ts`
- Modify: `apps/api/src/modules/consult/consult.controller.ts`

**Interfaces:**
- Consumes: Tasks 8–11, `effectivePermissions` (Task 1).
- Produces (all under `/v1/consult`):

| route | `@Permissions` |
|---|---|
| `GET practice/sessions` | `'sessions.view-all', 'practice.staff'` |
| `GET practice/sessions/:bookingId` | `'sessions.view-all', 'practice.staff'` |
| `PATCH practice/sessions/:bookingId/status` | `'sessions.edit', 'clinical.record'` |
| `POST practice/sessions/:bookingId/reschedule` | `'sessions.edit'` |
| `PATCH practice/sessions/:bookingId/summary` | `'sessions.summary'` |
| `POST practice/sessions/:bookingId/recap-email` | `'sessions.summary'` |
| `GET practice/clients/:profileId/sessions` | `'practice.staff'` |
| `GET practice/clients/:profileId/payments` | `'payments.desk'` |

- [ ] **Step 1: Wire the module** — import and add `SessionDirectoryService` to
  `providers` in `consult.module.ts`.

- [ ] **Step 2: Add the routes.** Inject
  `private readonly sessions: SessionDirectoryService` into
  `ConsultController`; import `Permissions, effectivePermissions` from
  `'../../common/permissions'` and `BadRequestException` if not imported.
  After the `createStaffBooking` handler:

```ts
  /** Who the session routes act as: the guard already loaded role and grants. */
  private actor(req: any) {
    const held = effectivePermissions(String(req.user?.role ?? ''), (req.user?.permissions ?? []) as string[]);
    return {
      profileId: authenticatedProfileId(req),
      viewAll: held.has('sessions.view-all'),
      clinical: held.has('clinical.record'),
      desk: held.has('payments.desk'),
    };
  }

  @Permissions('sessions.view-all', 'practice.staff')
  @Get('practice/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'The practice session register, scoped by permission' })
  listSessions(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('providerProfileId') providerProfileId?: string,
    @Query('q') q?: string,
  ) {
    return this.sessions.listSessions(authenticatedTenantId(req), this.actor(req), {
      status: (['upcoming', 'past'].includes(String(status)) ? status : 'all') as 'upcoming' | 'past' | 'all',
      providerProfileId: providerProfileId && /^\d+$/.test(providerProfileId) ? BigInt(providerProfileId) : undefined,
      search: q,
    });
  }

  @Permissions('sessions.view-all', 'practice.staff')
  @Get('practice/sessions/:bookingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'One session, with what the caller may do to it' })
  getSession(@Req() req: any, @Param('bookingId') bookingId: string) {
    if (!/^\d+$/.test(bookingId)) throw new NotFoundException('Session not found');
    return this.sessions.getSession(authenticatedTenantId(req), this.actor(req), BigInt(bookingId));
  }

  @Permissions('sessions.edit', 'clinical.record')
  @Patch('practice/sessions/:bookingId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Confirm, complete or cancel a session' })
  setSessionStatus(@Req() req: any, @Param('bookingId') bookingId: string, @Body() dto: { status?: string }) {
    if (!/^\d+$/.test(bookingId)) throw new NotFoundException('Session not found');
    const s = String(dto?.status ?? '');
    if (!['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(s)) throw new BadRequestException('Choose a status.');
    return this.sessions.setStatus(authenticatedTenantId(req), this.actor(req), BigInt(bookingId), s as 'CONFIRMED' | 'COMPLETED' | 'CANCELLED');
  }

  @Permissions('sessions.edit')
  @Post('practice/sessions/:bookingId/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Move a session to another open slot' })
  rescheduleSession(@Req() req: any, @Param('bookingId') bookingId: string, @Body() dto: { availabilityId?: string }) {
    if (!/^\d+$/.test(bookingId) || !/^\d+$/.test(String(dto?.availabilityId ?? ''))) {
      throw new NotFoundException('Session not found');
    }
    return this.sessions.rescheduleByStaff(authenticatedTenantId(req), this.actor(req), BigInt(bookingId), BigInt(dto.availabilityId));
  }

  @Permissions('sessions.summary')
  @Patch('practice/sessions/:bookingId/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Internal summary and client recap' })
  setSessionSummary(
    @Req() req: any,
    @Param('bookingId') bookingId: string,
    @Body() dto: { internalSummary?: string | null; clientRecap?: string | null },
  ) {
    if (!/^\d+$/.test(bookingId)) throw new NotFoundException('Session not found');
    return this.sessions.setSummary(authenticatedTenantId(req), this.actor(req), BigInt(bookingId), dto ?? {});
  }

  @Permissions('sessions.summary')
  @Post('practice/sessions/:bookingId/recap-email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Email the recap to the client' })
  sendSessionRecap(@Req() req: any, @Param('bookingId') bookingId: string) {
    if (!/^\d+$/.test(bookingId)) throw new NotFoundException('Session not found');
    return this.sessions.sendRecap(authenticatedTenantId(req), this.actor(req), BigInt(bookingId));
  }

  @Permissions('practice.staff')
  @Get('practice/clients/:profileId/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'One client’s sessions' })
  clientSessions(@Req() req: any, @Param('profileId') profileId: string) {
    if (!/^\d+$/.test(profileId)) throw new NotFoundException('Client not found');
    return this.sessions.clientSessions(authenticatedTenantId(req), this.actor(req), BigInt(profileId));
  }

  @Permissions('payments.desk')
  @Get('practice/clients/:profileId/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'One client’s payment history' })
  clientPayments(@Req() req: any, @Param('profileId') profileId: string) {
    if (!/^\d+$/.test(profileId)) throw new NotFoundException('Client not found');
    return this.sessions.clientPayments(authenticatedTenantId(req), BigInt(profileId));
  }
```

- [ ] **Step 3: Run the suite and typecheck**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json && npx vitest run 2>&1 | tail -3`
Expected: PASS — `roles.spec.ts` sees `@Permissions` on every new route.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/consult
git commit -m "Expose the session register, the session page actions and client history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Part C: the app

### Task 13: Sessions page

**Files:**
- Create: `apps/app/src/pages/practice/SessionsPage.tsx`
- Modify: `apps/app/src/components/shell/practiceNav.tsx` (nav entry), `apps/app/src/App.tsx` (lazy import + route)
- Test: `apps/app/src/pages/__tests__/SessionsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../test/renderWithApp';

const apiGet = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn() } }));

const { SessionsPage } = await import('../practice/SessionsPage');

const ROWS = [
  { id: '1', startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), endsAt: '', status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: '3500000', holdExpiresAt: null, bookedBy: null, client: { id: '40', name: 'Ada Ola' }, serviceTitle: 'Individual Therapy', provider: { id: '6', name: 'Segun Ade' }, channel: 'VIDEO' },
];

afterEach(() => { cleanup(); apiGet.mockReset(); });

const renderPage = (can = { viewAll: true }) => {
  apiGet.mockImplementation((path: string) => {
    if (path.startsWith('/v1/consult/practice/sessions')) return Promise.resolve(ROWS);
    return Promise.resolve([]);
  });
  return renderWithApp(<SessionsPage can={can as any} />, { route: '/dashboard/sessions' });
};

describe('SessionsPage', () => {
  it('lists sessions with a link to each', async () => {
    renderPage();
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Ada Ola')).toBeTruthy());
    expect(within(screen.getByRole('table')).getByRole('link', { name: /Ada Ola/ }).getAttribute('href')).toBe('/dashboard/sessions/1');
  });
  it('tabs change what is asked for', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Past' }));
    await waitFor(() => expect(apiGet.mock.calls.some((c: string[]) => c[0].includes('status=past'))).toBe(true));
  });
  it('searches through the API', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sessions' }), { target: { value: 'ada' } });
    await waitFor(() => expect(apiGet.mock.calls.some((c: string[]) => c[0].includes('q=ada'))).toBe(true));
  });
  it('hides the practitioner column from non-view-all staff', async () => {
    renderPage({ viewAll: false });
    await waitFor(() => expect(screen.getByRole('table')).toBeTruthy());
    expect(screen.queryByText('Practitioner')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** (import unresolved)

- [ ] **Step 3: Implement**

`apps/app/src/pages/practice/SessionsPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Page, PageHeader, ResponsiveTable, StatusBadge, type Column } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { RouterLink } from '../../components/shell/RouterLink';
import { PaymentChip } from '../../components/booking/PaymentChip';

export interface SessionRow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  paymentMethod: string;
  amountKobo: string | null;
  holdExpiresAt: string | null;
  bookedBy: string | null;
  client: { id: string; name: string };
  serviceTitle: string;
  provider: { id: string; name: string };
  channel: string;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const TABS = ['Upcoming', 'Past', 'All'] as const;

export function SessionsPage({ can }: { can: { viewAll: boolean } }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Upcoming');
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab !== 'All') params.set('status', tab.toLowerCase());
    if (q.trim()) params.set('q', q.trim());
    api
      .get<SessionRow[]>(`/v1/consult/practice/sessions?${params.toString()}`)
      .then((r) => { setRows(r); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the sessions'))
      .finally(() => setLoading(false));
  }, [tab, q]);

  const columns: Column<SessionRow>[] = [
    {
      key: 'client',
      header: 'Client',
      sort: (a, b) => a.client.name.localeCompare(b.client.name),
      cell: (r) => (
        <span className="flex items-center gap-2 min-w-0">
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-[#0F172A] truncate">{r.client.name}</span>
            <span className="block text-[11.5px] text-[#94A3B8] truncate">{r.serviceTitle}</span>
          </span>
        </span>
      ),
      className: 'w-full max-w-0',
    },
    { key: 'when', header: 'When', sort: (a, b) => a.startsAt.localeCompare(b.startsAt), cell: (r) => <span className="whitespace-nowrap">{when(r.startsAt)}</span> },
    ...(can.viewAll ? [{ key: 'provider', header: 'Practitioner', priority: 'md' as const, cell: (r: SessionRow) => <span className="truncate">{r.provider.name}</span> }] : []),
    { key: 'status', header: 'Status', priority: 'md', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'payment', header: 'Payment', priority: 'lg', cell: (r) => <PaymentChip status={r.status} paymentMethod={r.paymentMethod} holdExpiresAt={r.holdExpiresAt} /> },
  ];

  return (
    <Page
      header={
        <PageHeader
          eyebrow="THE REGISTER"
          title="Sessions"
          actions={
            <div role="tablist" className="h-[40px] p-1 bg-[#EEF2F7] rounded-[14px] inline-flex gap-1 border border-[#E2E8F0]">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`px-4 shrink-0 whitespace-nowrap rounded-[10px] text-xs font-bold cursor-pointer ${tab === t ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          }
        />
      }
    >
      {error ? (
        <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      ) : null}
      <div className="rounded-[20px] border border-[#E2E8F0] bg-white overflow-hidden">
        <ResponsiveTable<SessionRow>
          caption="Sessions"
          rows={rows}
          rowKey={(r) => r.id}
          rowLabel={(r) => `${r.client.name}, ${when(r.startsAt)}`}
          columns={columns}
          rowHref={(r) => `/dashboard/sessions/${r.id}`}
          LinkComponent={RouterLink}
          state={loading ? 'loading' : 'ready'}
          empty={tab === 'Upcoming' ? 'Nothing scheduled ahead.' : 'No sessions here yet.'}
          filter={{ placeholder: 'Search sessions', query: q, onQueryChange: setQ }}
        />
      </div>
    </Page>
  );
}
```

- [ ] **Step 4: Nav + route**

`practiceNav.tsx` MAIN — insert after Schedule:
`{ href: '/dashboard/sessions', label: 'Sessions', icon: ClipboardList },`
(add `ClipboardList` to the lucide import).

`App.tsx`:
`const SessionsPage = lazy(() => import('./pages/practice/SessionsPage').then((m) => ({ default: m.SessionsPage })));`
and inside the dashboard `<Routes>`:
`<Route path="/dashboard/sessions" element={<SessionsPage can={{ viewAll: (profile?.permissions ?? []).includes('sessions.view-all') }} />} />`

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
cd apps/app && npx vitest run src/pages/__tests__/SessionsPage.test.tsx && npx tsc --noEmit
git add apps/app/src
git commit -m "A sessions register: upcoming, past, all — yours or the practice's

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: The session page (hub)

**Files:**
- Create: `apps/app/src/pages/practice/SessionDetailPage.tsx`
- Modify: `apps/app/src/App.tsx` (route `/dashboard/sessions/:id`)
- Test: `apps/app/src/pages/__tests__/SessionDetailPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const apiGet = vi.fn();
const apiPatch = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    post: (...a: unknown[]) => apiPost(...a),
  },
  getBookingUrl: () => 'https://dr-smith.unclutterdesk.com',
  TENANT_SLUG: 'dr-smith',
}));

const { SessionDetailPage } = await import('../practice/SessionDetailPage');

const DETAIL = {
  id: '900', startsAt: '2026-10-01T09:00:00.000Z', endsAt: '2026-10-01T09:50:00.000Z',
  status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: '3500000', holdExpiresAt: null, bookedBy: 'Frank Desk',
  client: { id: '40', name: 'Ada Ola' }, serviceTitle: 'Individual Therapy',
  provider: { id: '6', name: 'Segun Ade' }, channel: 'VIDEO',
  clientEmail: 'ada@example.com', clientPhone: '0801', videoRoomLink: 'https://meet.jit.si/room-9',
  note: null, internalSummary: null, clientRecap: null, clientRecapSentAt: null,
  can: { edit: true, summary: true, markPaid: true },
};

beforeEach(() => { apiGet.mockReset(); apiPatch.mockReset(); apiPost.mockReset(); });
afterEach(cleanup);

function renderPage(detail = DETAIL) {
  apiGet.mockImplementation((p: string) => (p === '/v1/consult/practice/sessions/900' ? Promise.resolve(detail) : Promise.resolve([])));
  return renderWithApp(
    <Routes><Route path="/dashboard/sessions/:id" element={<SessionDetailPage />} /></Routes>,
    { route: '/dashboard/sessions/900' },
  );
}

describe('SessionDetailPage', () => {
  it('shows who, what, when and who booked it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Ola' })).toBeTruthy());
    expect(screen.getByText('Individual Therapy')).toBeTruthy();
    expect(screen.getByText(/Segun Ade/)).toBeTruthy();
    expect(screen.getByText(/Booked by Frank Desk/)).toBeTruthy();
  });
  it('start and prep point at the existing flows', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.getByRole('link', { name: /Start session/ }).getAttribute('href')).toBe('/session/900');
    expect(screen.getByRole('link', { name: /Session prep/ }).getAttribute('href')).toBe('/session/900/prep');
  });
  it('saves the summary and sends the recap', async () => {
    apiPatch.mockResolvedValue({ id: '900' });
    apiPost.mockResolvedValue({ id: '900', sentAt: new Date().toISOString() });
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    fireEvent.change(screen.getByLabelText('Client recap'), { target: { value: 'Practised breathing.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/summary', expect.objectContaining({ clientRecap: 'Practised breathing.' })));
    fireEvent.click(screen.getByRole('button', { name: /Send recap/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/recap-email'));
  });
  it('hides what the caller may not do', async () => {
    renderPage({ ...DETAIL, can: { edit: false, summary: false, markPaid: false } });
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.queryByRole('button', { name: /Mark as paid/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cancel session/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Implement**

`apps/app/src/pages/practice/SessionDetailPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Download, FileText, Loader2, Video } from 'lucide-react';
import { Card, Eyebrow, Page, PageHeader, StatTile, StatusBadge, useToast } from '@unclutterdesk/ui';
import { PaymentChip } from '../../components/booking/PaymentChip';
import { api } from '../../utils/apiClient';
import type { SessionRow } from './SessionsPage';

interface SessionDetail extends SessionRow {
  clientEmail: string;
  clientPhone: string | null;
  videoRoomLink: string | null;
  note: { id: string; status: 'DRAFT' | 'COMPLETED' } | null;
  internalSummary: string | null;
  clientRecap: string | null;
  clientRecapSentAt: string | null;
  can: { edit: boolean; summary: boolean; markPaid: boolean };
}

const naira = (kobo: string | null) => (kobo === null ? '—' : `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`);
const longWhen = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function SessionDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [d, setD] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internal, setInternal] = useState('');
  const [recap, setRecap] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`)
      .then((r) => {
        setD(r);
        setInternal(r.internalSummary ?? '');
        setRecap(r.clientRecap ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this session'));
  }, [id]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setD(await api.get<SessionDetail>(`/v1/consult/practice/sessions/${id}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Page header={<PageHeader title="Session" />}>
        <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      </Page>
    );
  }
  if (!d) {
    return (
      <Page header={<PageHeader title="Session" />}>
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#64748B]" /></div>
      </Page>
    );
  }

  const area = 'w-full px-3 py-2 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] outline-none';

  return (
    <Page
      header={
        <PageHeader
          eyebrow="SESSION"
          title={d.client.name}
          actions={
            <>
              {d.channel === 'VIDEO' && d.videoRoomLink ? (
                <Link to={`/session/${d.id}`} className="h-[40px] px-4 rounded-[12px] bg-[#0F3A53] text-white text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer">
                  <Video className="h-4 w-4" /> Start session
                </Link>
              ) : null}
              <Link to={`/session/${d.id}/prep`} className="h-[40px] px-4 rounded-[12px] bg-white border border-[#CBD5E1] text-[#0F172A] text-[12.5px] font-bold inline-flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" /> Session prep
              </Link>
            </>
          }
          secondaryActions={
            d.can.edit ? (
              <>
                {d.status === 'CONFIRMED' ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => api.patch(`/v1/consult/practice/sessions/${d.id}/status`, { status: 'COMPLETED' }), 'Session completed')} className="h-[40px] px-4 rounded-[12px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" /> Complete
                  </button>
                ) : null}
                {d.status === 'PENDING_PAYMENT' && d.can.markPaid ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => api.post(`/v1/consult/bookings/${d.id}/mark-paid`, {}), 'Payment recorded')} className="h-[40px] px-4 rounded-[12px] bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    <Download className="h-4 w-4" /> Mark as paid
                  </button>
                ) : null}
                {d.status !== 'CANCELLED' && d.status !== 'COMPLETED' ? (
                  <button type="button" disabled={busy} onClick={() => void act(() => api.patch(`/v1/consult/practice/sessions/${d.id}/status`, { status: 'CANCELLED' }), 'Session cancelled — the time is open again')} className="h-[40px] px-4 rounded-[12px] bg-white border border-rose-200 text-rose-600 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    Cancel session
                  </button>
                ) : null}
              </>
            ) : null
          }
        />
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={d.status} />
        <PaymentChip status={d.status} paymentMethod={d.paymentMethod} holdExpiresAt={d.holdExpiresAt} />
        {d.bookedBy ? <span className="text-[11.5px] text-[#64748B]">Booked by {d.bookedBy}</span> : null}
      </div>

      <Card padding="p-[22px]" className="space-y-4">
        <Eyebrow>THE SESSION</Eyebrow>
        <div className="grid grid-cols-1 @min-[640px]/page:grid-cols-2 gap-3">
          <StatTile variant="inset" size="sm" label="WHEN" value={longWhen(d.startsAt)} />
          <StatTile variant="inset" size="sm" label="SERVICE" value={d.serviceTitle} />
          <StatTile variant="inset" size="sm" label="PRACTITIONER" value={d.provider.name} />
          <StatTile variant="inset" size="sm" label="PAID" value={`${d.paymentMethod === 'NONE' ? 'No charge' : naira(d.amountKobo)} · ${d.channel === 'VIDEO' ? 'Video' : 'In person'}`} />
        </div>
        <p className="text-[12.5px] text-[#64748B]">
          {d.clientEmail}{d.clientPhone ? ` · ${d.clientPhone}` : ''}
          {' · '}
          <Link to={`/dashboard/clients/${d.client.id}`} className="font-bold text-[#0F3A53] underline">Client file</Link>
        </p>
        {d.note ? (
          <p className="text-[12.5px] font-medium text-[#475569] inline-flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" /> Note {d.note.status === 'COMPLETED' ? 'signed' : 'in draft'}
          </p>
        ) : null}
      </Card>

      {d.can.summary ? (
        <Card padding="p-[22px]" className="space-y-3">
          <Eyebrow>SUMMARY</Eyebrow>
          <label className="block text-[11.5px] font-bold text-slate-500 uppercase">
            Internal summary (staff only)
            <textarea rows={3} className={area} value={internal} onChange={(e) => setInternal(e.target.value)} placeholder="What happened, for the file." />
          </label>
          <label className="block text-[11.5px] font-bold text-slate-500 uppercase">
            Client recap
            <textarea rows={3} className={area} value={recap} onChange={(e) => setRecap(e.target.value)} placeholder="Written for the client: what was covered, what to practise." />
          </label>
          {d.clientRecapSentAt ? (
            <p className="text-[11.5px] text-emerald-700 font-semibold">Recap sent {new Date(d.clientRecapSentAt).toLocaleDateString('en-GB')}.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => api.patch(`/v1/consult/practice/sessions/${d.id}/summary`, { internalSummary: internal, clientRecap: recap }), 'Summary saved')}
              className="h-[38px] px-4 rounded-[12px] bg-[#0F3A53] text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy || !recap.trim()}
              onClick={() => void act(() => api.post(`/v1/consult/practice/sessions/${d.id}/recap-email`, {}), 'Recap emailed to the client')}
              className="h-[38px] px-4 rounded-[12px] bg-white border border-[#CBD5E1] text-[#0F172A] text-[12.5px] font-bold cursor-pointer disabled:opacity-50"
            >
              Send recap
            </button>
          </div>
        </Card>
      ) : null}
    </Page>
  );
}
```

- [ ] **Step 4: Route** — `App.tsx`:
`const SessionDetailPage = lazy(() => import('./pages/practice/SessionDetailPage').then((m) => ({ default: m.SessionDetailPage })));`
`<Route path="/dashboard/sessions/:id" element={<SessionDetailPage />} />`

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
cd apps/app && npx vitest run src/pages/__tests__/SessionDetailPage.test.tsx && npx tsc --noEmit && npx vitest run 2>&1 | tail -3
git add apps/app/src
git commit -m "One page per session: status, payment, start, prep, summary and recap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: Client page — real history and payments

**Files:**
- Modify: `apps/app/src/pages/practice/ClientDetailPage.tsx`
- Modify: `apps/app/src/App.tsx` (pass `canViewPayments`)
- Test: `apps/app/src/pages/__tests__/ClientDetailPageHistory.test.tsx` (new; the existing client-page tests stay untouched)

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const apiGet = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn() } }));

const { ClientDetailPage } = await import('../practice/ClientDetailPage');

const CLIENT = {
  id: '40', name: 'Ada Ola', email: 'ada@example.com', care: 'Individual Therapy', sessions: '2',
  next: 'None scheduled', status: 'Active', initials: 'AO', phone: '0801', since: 'Sept 2026',
  emergency: '', notes: [], intake: [],
};
const SESSIONS = [
  { id: '900', startsAt: '2026-08-01T09:00:00.000Z', endsAt: '2026-08-01T09:50:00.000Z', status: 'COMPLETED', paymentMethod: 'PAYSTACK', amountKobo: '3500000', holdExpiresAt: null, bookedBy: null, client: { id: '40', name: 'Ada Ola' }, serviceTitle: 'Individual Therapy', provider: { id: '6', name: 'Segun' }, channel: 'VIDEO' },
];
const PAYMENTS = {
  payments: [{ bookingId: '900', serviceTitle: 'Individual Therapy', sessionAt: '2026-08-01T09:00:00.000Z', amountKobo: '3500000', discountCode: null, status: 'COMPLETED', paidAt: '2026-07-20T10:00:00.000Z', reference: 'booking-900-1', bookedAt: '2026-07-19T10:00:00.000Z' }],
  totalPaidKobo: '3500000',
  outstandingKobo: '0',
};

beforeEach(() => apiGet.mockReset());
afterEach(cleanup);

function renderPage(canViewPayments = true) {
  apiGet.mockImplementation((p: string) => {
    if (p.includes('/sessions')) return Promise.resolve(SESSIONS);
    if (p.includes('/payments')) return Promise.resolve(PAYMENTS);
    return Promise.resolve([]);
  });
  return renderWithApp(
    <Routes>
      <Route path="/dashboard/clients/:id" element={<ClientDetailPage clients={[CLIENT] as any} setClients={() => undefined} canViewPayments={canViewPayments} />} />
    </Routes>,
    { route: '/dashboard/clients/40' },
  );
}

describe('client history', () => {
  it('lists the client’s sessions with a link to each session page', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('link', { name: /Client file|Ada Ola/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Session history' }));
    await waitFor(() => expect(screen.getByRole('link', { name: /Individual Therapy/ })).toHaveAttribute('href', '/dashboard/sessions/900'));
  });
  it('shows the payments tab with totals', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
    await waitFor(() => expect(screen.getByText('₦35,000')).toBeTruthy());
    expect(screen.getByText(/Outstanding/i)).toBeTruthy();
  });
  it('hides the payments tab from staff without the desk permission', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session history' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Payments' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd apps/app && npx vitest run src/pages/__tests__/ClientDetailPageHistory.test.tsx`

- [ ] **Step 3: Implement**

1. Props: `canViewPayments?: boolean;` on `ClientDetailPageProps`; App passes
   `canViewPayments={(profile?.permissions ?? []).includes('payments.desk')}`.
2. Tabs array: add `{ id: 'payments', label: 'Payments' }` when
   `canViewPayments`.
3. Session history tab: above the existing SOAP timeline, render a Sessions
   section:

```tsx
  const [clientSessions, setClientSessions] = useState<SessionRow[]>([]);
  useEffect(() => {
    api.get<SessionRow[]>(`/v1/consult/practice/clients/${client.id}/sessions`)
      .then(setClientSessions).catch(() => setClientSessions([]));
  }, [client.id]);
```

   and, inside the history tab, before the timeline:

```tsx
            <div className="rounded-[20px] border border-[#E2E8F0] bg-white overflow-hidden">
              <ResponsiveTable<SessionRow>
                caption={`Sessions for ${client.name}`}
                rows={clientSessions}
                rowKey={(r) => r.id}
                rowLabel={(r) => `${r.serviceTitle}, ${r.startsAt}`}
                columns={SESSION_COLUMNS}
                rowHref={(r) => `/dashboard/sessions/${r.id}`}
                LinkComponent={RouterLink}
                empty="No sessions yet."
              />
            </div>
```

   with `SESSION_COLUMNS` a module-level `Column<SessionRow>[]`: When (sorted),
   Service (the linked cell, `className: 'w-full max-w-0'`), Practitioner
   (`priority: 'md'`), Status (`priority: 'md'`, `StatusBadge` +
   `PaymentChip`). Import `SessionRow` from `./SessionsPage`, `ResponsiveTable`,
   `type Column` from `@unclutterdesk/ui`, `RouterLink`, `PaymentChip`.
4. Payments tab body:

```tsx
          {activeTab === 'payments' && (
            <Card padding="p-[24px_26px]" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatTile label="TOTAL PAID" value={`₦${(Number(clientPayments?.totalPaidKobo ?? 0) / 100).toLocaleString('en-NG')}`} />
                <StatTile label="OUTSTANDING" value={`₦${(Number(clientPayments?.outstandingKobo ?? 0) / 100).toLocaleString('en-NG')}`} />
              </div>
              <div className="rounded-[20px] border border-[#E2E8F0] bg-white overflow-hidden">
                <ResponsiveTable<PaymentRow>
                  caption={`Payments for ${client.name}`}
                  rows={clientPayments?.payments ?? []}
                  rowKey={(p) => p.bookingId}
                  columns={PAYMENT_COLUMNS}
                  state={clientPayments ? 'ready' : 'loading'}
                  empty="No payments yet."
                />
              </div>
            </Card>
          )}
```

   with local types and columns:

```tsx
interface PaymentRow {
  bookingId: string; serviceTitle: string; sessionAt: string; amountKobo: string;
  discountCode: string | null; status: string; paidAt: string | null; reference: string | null; bookedAt: string;
}
const PAYMENT_COLUMNS: Column<PaymentRow>[] = [
  { key: 'service', header: 'Session', cell: (p) => <span className="font-bold text-[#0F172A]">{p.serviceTitle}</span>, className: 'w-full max-w-0' },
  { key: 'amount', header: 'Amount', align: 'end', cell: (p) => `₦${(Number(p.amountKobo) / 100).toLocaleString('en-NG')}` },
  { key: 'paid', header: 'Paid on', priority: 'md', cell: (p) => (p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB') : '—') },
  { key: 'ref', header: 'Reference', priority: 'lg', cell: (p) => <span className="text-[11.5px] text-[#64748B]">{p.reference ?? '—'}</span> },
];
```

   and state + fetch:

```tsx
  const [clientPayments, setClientPayments] = useState<{ payments: PaymentRow[]; totalPaidKobo: string; outstandingKobo: string } | null>(null);
  useEffect(() => {
    if (!props.canViewPayments) return;
    api.get<{ payments: PaymentRow[]; totalPaidKobo: string; outstandingKobo: string }>(`/v1/consult/practice/clients/${client.id}/payments`)
      .then(setClientPayments).catch(() => setClientPayments({ payments: [], totalPaidKobo: '0', outstandingKobo: '0' }));
  }, [client.id, props.canViewPayments]);
```

- [ ] **Step 4: Run the suite and typecheck**

Run: `cd apps/app && npx tsc --noEmit && npx vitest run 2>&1 | tail -3`
Expected: PASS (the new history tests plus every existing client-page test).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src
git commit -m "The client page now tells you what happened: sessions and payments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 16: Verify and ship

- [ ] **Step 1: Full suites + build**

Run: `pnpm --recursive run typecheck && cd apps/api && npx vitest run && cd ../app && npx vitest run && npx vite build`
Expected: all pass; the build succeeds.

- [ ] **Step 2: Live RBAC check**

Start the API (`cd apps/api && npx nest build && PORT=3099 node dist/src/main.js`)
and the app (`cd apps/app && VITE_API_URL=http://localhost:3099 npx vite --port 5173 --strictPort`).
As `dr.jane@smiththerapy.ng` (OWNER):
1. Open the team page → Segun's row → Permissions… → tick "Front-desk money" →
   Save. Expected: saved toast.
2. Sign in as `nkem@smiththerapy.ng` (THERAPIST) → Sessions page shows only
   their own sessions; the session page of one of Jane's sessions 404s.
3. Back as Jane: grant Segun `sessions.view-all` → reload as Segun → the full
   register appears with the Practitioner column.

- [ ] **Step 3: Live sessions check**

As Jane: Sessions → Upcoming → open a session → Complete → Summary: write a
recap → Save → Send recap (local Resend delivers or logs). Cancel a booking →
its slot is open again in Availability. Client page → Session history links to
the session page; Payments shows the totals.

- [ ] **Step 4: Layout check for the new routes**

Add `'/dashboard/sessions'` to `STRICT` in `apps/app/scripts/check-layout.mjs`
(SessionDetailPage needs a live id — leave it out of STRICT until PR 4's
cleanup, or reuse the CLIENT trick with a `SESSION` placeholder the same way).
Run `pnpm --filter @unclutterdesk/app check:layout` (needs both servers up).
Expected: exit 0.

- [ ] **Step 5: Stop the servers, push, and the PR**

```bash
git push origin dev
```

If `gh pr list --head dev --state open` shows nothing:

```bash
gh pr create --base main --head dev --title "Permissions RBAC, the sessions register and the session page" --body "$(cat <<'EOF'
## What
- **RBAC:** every route now asks for a named permission (`@Permissions`), granted by role or by per-person ticks on the team page. The role map reproduces the old role groups exactly, so nothing changed hands — but access is now editable without a code change.
- **Sessions register** (`/dashboard/sessions`): upcoming, past, all; search; practitioners column for desk/admins; therapists see their own diary.
- **Session page** (`/dashboard/sessions/:id`): status, payment, Start / Prep, Complete / Cancel (and Mark as paid for the desk), an internal summary and a client recap you send on purpose.
- **Client page:** real session history list and a Payments tab (front-desk roles).

## API
- `PATCH /v1/tenant/staff/:profileId/permissions`; staff rows and the signed-in profile carry `permissions`.
- `GET/PATCH/POST /v1/consult/practice/sessions…` (register, detail, status, reschedule, summary, recap-email) and `GET /v1/consult/practice/clients/:id/{sessions,payments}`.
- `ConsultBooking.internalSummary / clientRecap / clientRecapSentAt` (migration `20260928150000_session_summaries`).

## Checks
- API, package and app suites pass; every package typechecks.
- `roles.spec` now enforces `@Permissions` on every authenticated route.
- Live: grant → therapist sees the practice register; revoke → back to their own.

Spec: `docs/superpowers/specs/2026-09-28-sessions-rbac-design.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If one is open (e.g. PR #37 for responsive PR 2): these commits join it; add a
section describing this feature with `gh pr edit <n> --body-file <file>`,
keeping the existing description.
