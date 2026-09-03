import { SetMetadata } from '@nestjs/common';

/**
 * Practice roles, as stored on `Profile.role`.
 *
 * CLIENT is a person receiving care. Everyone else is practice staff. The
 * distinction is the one that matters most: before this guard existed, a signed
 * in client could reach every staff endpoint, including clinical notes.
 */
export const PRACTICE_ROLES = ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST', 'CLIENT'] as const;
export type PracticeRole = (typeof PRACTICE_ROLES)[number];

/** Everyone who works at the practice — i.e. not the client. */
export const STAFF: PracticeRole[] = ['OWNER', 'ADMIN', 'THERAPIST', 'RECEPTIONIST'];

/** Roles that may see or write clinical records. */
export const CLINICAL: PracticeRole[] = ['OWNER', 'ADMIN', 'THERAPIST'];

/** Roles that administer the practice itself: staff, billing, branding. */
export const PRACTICE_ADMIN: PracticeRole[] = ['OWNER', 'ADMIN'];

export const ROLES_KEY = 'requiredRoles';

/**
 * Restricts a route to the listed roles.
 *
 * Required on every route behind `JwtAuthGuard` — `roles.spec.ts` fails the
 * build if one is missing, so a new endpoint cannot quietly inherit the old
 * "any authenticated user" behaviour. Use `@AnyAuthenticated()` for routes that
 * genuinely serve clients as well as staff.
 */
export const Roles = (...roles: PracticeRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Explicitly allows any signed-in profile in the tenant, including clients.
 *
 * Deliberately verbose: it should be obvious in review that a route was
 * considered and opened up, rather than never annotated.
 */
export const AnyAuthenticated = () => SetMetadata(ROLES_KEY, [...PRACTICE_ROLES]);
