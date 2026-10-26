/**
 * What each plan includes. The one place a plan's limits are written down.
 *
 * Gating used to be string comparisons scattered through services
 * (`tier === 'STARTER'`), and the numbers had already drifted apart: Starter
 * was 20 bookings in code and 25 on the landing page. Every check now reads
 * this table, and `entitlements.spec.ts` fails if a tier comparison appears
 * anywhere else in the API.
 */
export type Tier = 'FREE' | 'STARTER' | 'PRO' | 'CLINIC';

export const TIERS: Tier[] = ['FREE', 'STARTER', 'PRO', 'CLINIC'];

export type StaffRole = 'ADMIN' | 'RECEPTIONIST' | 'THERAPIST';

export interface Entitlements {
  /** Bookings a practice may take in a calendar month; null = unlimited. */
  monthlyBookingLimit: number | null;
  /** Platform fee on booking payments, in basis points (500 = 5%). */
  platformFeeBps: number;
  customDomain: boolean;
  /** Roles the practice may invite. Empty = no staff beyond the owner. */
  staffInviteRoles: StaffRole[];
  /** Compared with an instrument's minimum plan (see `instrumentAllowed`). */
  assessmentRank: number;
  googleCalendarSync: boolean;
  /** Bank-transfer (manual) payments for bookings. Starter and above; FREE is Paystack only (spec D8). */
  bankTransferPayments: boolean;
  profileFeatures: { downloadablePdf: boolean; introVideo: boolean };
}

export type EntitlementKey = Exclude<keyof Entitlements, 'profileFeatures'> | 'downloadablePdf' | 'introVideo';

export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  FREE: {
    monthlyBookingLimit: 10,
    platformFeeBps: 500,
    customDomain: false,
    staffInviteRoles: [],
    assessmentRank: 0,
    googleCalendarSync: false,
    bankTransferPayments: false,
    profileFeatures: { downloadablePdf: false, introVideo: false },
  },
  STARTER: {
    monthlyBookingLimit: 30,
    platformFeeBps: 0,
    customDomain: false,
    staffInviteRoles: [],
    assessmentRank: 0,
    googleCalendarSync: true,
    bankTransferPayments: true,
    profileFeatures: { downloadablePdf: true, introVideo: true },
  },
  PRO: {
    monthlyBookingLimit: null,
    platformFeeBps: 0,
    customDomain: true,
    staffInviteRoles: ['ADMIN', 'RECEPTIONIST'],
    assessmentRank: 1,
    googleCalendarSync: true,
    bankTransferPayments: true,
    profileFeatures: { downloadablePdf: true, introVideo: true },
  },
  CLINIC: {
    monthlyBookingLimit: null,
    platformFeeBps: 0,
    customDomain: true,
    staffInviteRoles: ['ADMIN', 'RECEPTIONIST', 'THERAPIST'],
    assessmentRank: 2,
    googleCalendarSync: true,
    bankTransferPayments: true,
    profileFeatures: { downloadablePdf: true, introVideo: true },
  },
};

export const TIER_NAMES: Record<Tier, string> = {
  FREE: 'Free', // "Free therapist profile" once v2 Phase 1 ships profiles (spec §5.2)
  STARTER: 'Starter',
  PRO: 'Pro',
  CLINIC: 'Clinic',
};

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as string[]).includes(value);
}

/** The stored tier, normalised. Anything unrecognised is FREE, never a paid plan. */
export function tierOf(tenant: { subscriptionTier?: string | null } | null | undefined): Tier {
  const raw = (tenant?.subscriptionTier || '').toUpperCase();
  return isTier(raw) ? raw : 'FREE';
}

/**
 * The tenant's entitlements. An invite-code period sets `subscriptionTier`
 * itself, so a complimentary plan is read the same way as a paid one; once
 * `complimentaryUntil` has passed the plan is no longer honoured, even in the
 * hour before the expiry cron moves the practice back to FREE.
 */
export function entitlementsFor(
  tenant: { subscriptionTier?: string | null; complimentaryUntil?: Date | null } | null | undefined,
  now: Date = new Date(),
): Entitlements {
  return ENTITLEMENTS[effectiveTier(tenant, now)];
}

export function effectiveTier(
  tenant: { subscriptionTier?: string | null; complimentaryUntil?: Date | null } | null | undefined,
  now: Date = new Date(),
): Tier {
  if (tenant?.complimentaryUntil && tenant.complimentaryUntil.getTime() <= now.getTime()) return 'FREE';
  return tierOf(tenant);
}

/** True when the stored plan is FREE (or unrecognised, which counts as FREE). */
export function isFreeTier(tenant: { subscriptionTier?: string | null } | null | undefined): boolean {
  return tierOf(tenant) === 'FREE';
}

export function hasEntitlement(e: Entitlements, key: EntitlementKey): boolean {
  if (key === 'downloadablePdf' || key === 'introVideo') return e.profileFeatures[key];
  const value = e[key];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return value > 0;
  if (value === null) return true; // unlimited
  return Boolean(value);
}

/** The cheapest plan that includes `key`, following free → Starter → Pro → Clinic. */
export function requiredTierFor(key: EntitlementKey): Tier {
  return TIERS.find((t) => hasEntitlement(ENTITLEMENTS[t], key)) ?? 'CLINIC';
}

/** The cheapest plan whose staff invites include `role`. */
export function requiredTierForStaffRole(role: StaffRole): Tier {
  return TIERS.find((t) => ENTITLEMENTS[t].staffInviteRoles.includes(role)) ?? 'CLINIC';
}

/**
 * Upgrade prompts walk free → Starter → Pro and never skip straight to
 * Clinic (spec §5.2): the next plan up, or null on the top plan.
 */
export function nextTier(tier: Tier): Tier | null {
  if (tier === 'FREE') return 'STARTER';
  if (tier === 'STARTER') return 'PRO';
  if (tier === 'PRO') return 'CLINIC';
  return null;
}

// ── Assessments ──────────────────────────────────────────────────────────

/** An instrument's minimum plan, as stored on its definition. */
export type InstrumentTier = 'STARTER' | 'PRO' | 'CLINIC';

const INSTRUMENT_RANK: Record<InstrumentTier, number> = { STARTER: 0, PRO: 1, CLINIC: 2 };

export function instrumentAllowed(e: Entitlements, instrumentTier: InstrumentTier): boolean {
  return e.assessmentRank >= (INSTRUMENT_RANK[instrumentTier] ?? Infinity);
}

/** Platform fee on `amountKobo`, rounded to the nearest kobo. */
export function platformFeeKobo(e: Entitlements, amountKobo: bigint): bigint {
  return (amountKobo * BigInt(e.platformFeeBps) + 5_000n) / 10_000n;
}

/** Whether the practice may hold this many active staff (non-owner, non-client) and therapists. */
export function canHoldStaff(e: Entitlements, staffCount: number, therapistCount: number): boolean {
  if (staffCount > 0 && e.staffInviteRoles.length === 0) return false;
  if (therapistCount > 1 && !e.staffInviteRoles.includes('THERAPIST')) return false;
  return true;
}
