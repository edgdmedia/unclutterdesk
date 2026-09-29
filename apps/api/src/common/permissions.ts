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
