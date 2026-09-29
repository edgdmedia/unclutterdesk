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

/** Roles that handle money at the front desk, e.g. confirming a bank transfer. */
export const FRONT_DESK: PracticeRole[] = ['OWNER', 'ADMIN', 'RECEPTIONIST'];

export const PLATFORM_ADMIN_KEY = 'allowPlatformAdmin';

/**
 * Also admits a platform admin, who has no practice profile and so fails every
 * role check. Only for endpoints that handle that case themselves.
 */
export const AllowPlatformAdmin = () => SetMetadata(PLATFORM_ADMIN_KEY, true);
