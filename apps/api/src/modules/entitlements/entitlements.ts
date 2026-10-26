/**
 * What each plan includes. The one place a plan's limits are written down.
 *
 * Gating used to be string comparisons scattered through services
 * (`tier === 'STARTER'`), and the numbers had already drifted apart: Starter
 * was 20 bookings in code and 25 on the landing page. Every check now reads
 * these tables, and `entitlements.spec.ts` fails if a tier is compared with a
 * string, or `subscriptionTier` is read, anywhere else.
 *
 * Two scopes (spec §5.1): plans belong to practices, but profiles belong to
 * people. Practice entitlements come from the practice's own plan; profile
 * entitlements come from the best plan among the practices where the person
 * is an active OWNER or THERAPIST.
 */
export type Tier = 'FREE' | 'STARTER' | 'PRO' | 'CLINIC';

export const TIERS: Tier[] = ['FREE', 'STARTER', 'PRO', 'CLINIC'];

export type StaffRole = 'ADMIN' | 'RECEPTIONIST' | 'THERAPIST';

/** What a practice (tenant) can do. */
export interface PracticeEntitlements {
  /** Bookings a practice may take in a calendar month (Lagos time); null = unlimited. */
  monthlyBookingLimit: number | null;
  /** Platform fee on Paystack booking payments, in basis points (500 = 5%). */
  platformFeeBps: number;
  /** Bank-transfer (manual) payments for bookings. Starter and above; FREE is Paystack only (D8). */
  bankTransferPayments: boolean;
  customDomain: boolean;
  /** Roles the practice may invite. Empty = no staff beyond the owner. */
  staffInviteRoles: StaffRole[];
  /** Compared with an instrument's minimum plan (see `instrumentAllowed`). FREE ranks with STARTER. */
  assessmentRank: number;
  googleCalendarSync: boolean;
}

/** What a person's profile can do. */
export interface ProfileEntitlements {
  downloadablePdf: boolean;
  introVideo: boolean;
}

/** Practice features a plan either includes or doesn't. Limits and fees are read directly, not asked about. */
export type PracticeFeature = 'bankTransferPayments' | 'customDomain' | 'googleCalendarSync';
export type ProfileFeature = keyof ProfileEntitlements;

export const PRACTICE_ENTITLEMENTS: Record<Tier, PracticeEntitlements> = {
  FREE: {
    monthlyBookingLimit: 10,
    platformFeeBps: 500,
    bankTransferPayments: false,
    customDomain: false,
    staffInviteRoles: [],
    assessmentRank: 0,
    googleCalendarSync: false,
  },
  STARTER: {
    monthlyBookingLimit: 30,
    platformFeeBps: 0,
    bankTransferPayments: true,
    customDomain: false,
    staffInviteRoles: [],
    assessmentRank: 0,
    googleCalendarSync: true,
  },
  PRO: {
    monthlyBookingLimit: null,
    platformFeeBps: 0,
    bankTransferPayments: true,
    customDomain: true,
    staffInviteRoles: ['ADMIN', 'RECEPTIONIST'],
    assessmentRank: 1,
    googleCalendarSync: true,
  },
  CLINIC: {
    monthlyBookingLimit: null,
    platformFeeBps: 0,
    bankTransferPayments: true,
    customDomain: true,
    staffInviteRoles: ['ADMIN', 'RECEPTIONIST', 'THERAPIST'],
    assessmentRank: 2,
    googleCalendarSync: true,
  },
};

export const PROFILE_ENTITLEMENTS: Record<Tier, ProfileEntitlements> = {
  FREE: { downloadablePdf: false, introVideo: false },
  STARTER: { downloadablePdf: true, introVideo: true },
  PRO: { downloadablePdf: true, introVideo: true },
  CLINIC: { downloadablePdf: true, introVideo: true },
};

export const TIER_NAMES: Record<Tier, string> = {
  FREE: 'Free', // "Free therapist profile" once v2 Phase 1 ships profiles (spec §5.3)
  STARTER: 'Starter',
  PRO: 'Pro',
  CLINIC: 'Clinic',
};

const TIER_RANK: Record<Tier, number> = { FREE: 0, STARTER: 1, PRO: 2, CLINIC: 3 };

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as string[]).includes(value);
}

// ── Reading a practice's plan ────────────────────────────────────────────

/** The tenant fields a plan is worked out from. Required, so a query that forgets one fails to compile. */
export interface PlanFields {
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  complimentaryUntil: Date | null;
  complimentaryReason: string | null;
}

/** Spread into a Prisma `select` wherever a plan is worked out. */
export const PLAN_SELECT = {
  subscriptionTier: true,
  subscriptionStatus: true,
  complimentaryUntil: true,
  complimentaryReason: true,
} as const;

/** The plan a brand-new practice is created on. */
export const NEW_PRACTICE_TIER: Tier = 'FREE';

/** Paystack states in which a paid plan still holds; a lapsed one runs the §5.4a timeline before dropping. */
const LIVE_SUBSCRIPTION = ['active', 'past_due', 'cancelled'];

/** The stored tier, normalised. Anything unrecognised is FREE, never a paid plan. */
function storedTier(tenant: Pick<PlanFields, 'subscriptionTier'> | null | undefined): Tier {
  const raw = (tenant?.subscriptionTier || '').toUpperCase();
  return isTier(raw) ? raw : 'FREE';
}

/**
 * A complimentary plan in force: an end date still ahead, or INTERNAL with no
 * end date at all (Olalekan's practice, §5.4). A past end date is not
 * honoured, even in the hour before the expiry cron moves the practice.
 */
export function complimentaryActive(tenant: Omit<PlanFields, 'subscriptionTier' | 'subscriptionStatus'>, now: Date = new Date()): boolean {
  if (tenant.complimentaryUntil) return tenant.complimentaryUntil.getTime() > now.getTime();
  return tenant.complimentaryReason === 'INTERNAL';
}

/**
 * The plan a practice actually has. A paid tier needs a Paystack subscription
 * (active, or lapsing through the §5.4a timeline) or a complimentary plan in
 * force; otherwise it is FREE. Empty or unknown → FREE.
 */
export function effectiveTier(tenant: PlanFields | null | undefined, now: Date = new Date()): Tier {
  if (!tenant) return 'FREE';
  const tier = storedTier(tenant);
  if (TIER_RANK[tier] === 0) return 'FREE';
  if (tenant.complimentaryUntil && !complimentaryActive(tenant, now)) return 'FREE';
  if (complimentaryActive(tenant, now)) return tier;
  if (LIVE_SUBSCRIPTION.includes(tenant.subscriptionStatus ?? '')) return tier;
  return 'FREE';
}

export function practiceEntitlements(tenant: PlanFields | null | undefined, now: Date = new Date()): PracticeEntitlements {
  return PRACTICE_ENTITLEMENTS[effectiveTier(tenant, now)];
}

/** Explicit fee lookup, in basis points. */
export function platformFeeBps(tenant: PlanFields | null | undefined): number {
  return practiceEntitlements(tenant).platformFeeBps;
}

/** Platform fee on `amountKobo`, rounded to the nearest kobo. */
export function platformFeeKobo(bps: number, amountKobo: bigint): bigint {
  return (amountKobo * BigInt(bps) + 5_000n) / 10_000n;
}

/** What admin screens show about a practice's plan: the plan in effect and why. */
export function planView(tenant: PlanFields) {
  return {
    subscriptionTier: effectiveTier(tenant),
    subscriptionStatus: tenant.subscriptionStatus,
    complimentaryReason: tenant.complimentaryReason,
    complimentaryUntil: tenant.complimentaryUntil?.toISOString() ?? null,
  };
}

/** Whether the stored tier is a paid one (used by the lapse timeline, which only acts on paid plans). */
export function isPaidTier(tier: Tier): boolean {
  return TIER_RANK[tier] > 0;
}

// ── Profile scope ─────────────────────────────────────────────────────────

/** The best of several tiers (FREE when there are none). */
export function highestTier(tiers: Tier[]): Tier {
  return tiers.reduce<Tier>((best, t) => (TIER_RANK[t] > TIER_RANK[best] ? t : best), 'FREE');
}

/** Profile entitlements from the effective tiers of a person's qualifying practices. */
export function profileEntitlementsFromTiers(tiers: Tier[]): ProfileEntitlements {
  return PROFILE_ENTITLEMENTS[highestTier(tiers)];
}

// ── Required plans and upgrade prompts ──────────────────────────────────

/** The cheapest plan that includes a practice feature, following free → Starter → Pro → Clinic. */
export function requiredTierFor(feature: PracticeFeature): Tier {
  return TIERS.find((t) => PRACTICE_ENTITLEMENTS[t][feature]) ?? 'CLINIC';
}

export function requiredTierForProfile(feature: ProfileFeature): Tier {
  return TIERS.find((t) => PROFILE_ENTITLEMENTS[t][feature]) ?? 'CLINIC';
}

/** The cheapest plan whose staff invites include `role`. */
export function requiredTierForStaffRole(role: StaffRole): Tier {
  return TIERS.find((t) => PRACTICE_ENTITLEMENTS[t].staffInviteRoles.includes(role)) ?? 'CLINIC';
}

/**
 * Upgrade prompts walk free → Starter → Pro and never skip straight to
 * Clinic (spec §5.3): the next plan up, or null on the top plan.
 */
export function nextTier(tier: Tier): Tier | null {
  return TIERS[TIER_RANK[tier] + 1] ?? null;
}

// ── Assessments ──────────────────────────────────────────────────────────

/** An instrument's minimum plan, as stored on its definition. Saved definitions say 'STARTER'; FREE ranks with it. */
export type InstrumentTier = 'STARTER' | 'PRO' | 'CLINIC';

const INSTRUMENT_RANK: Record<InstrumentTier, number> = { STARTER: 0, PRO: 1, CLINIC: 2 };

export function instrumentAllowed(e: PracticeEntitlements, instrumentTier: InstrumentTier): boolean {
  return e.assessmentRank >= (INSTRUMENT_RANK[instrumentTier] ?? Infinity);
}

// ── Staff ─────────────────────────────────────────────────────────────────

/** Whether a plan can hold this many active staff (non-owner, non-client) and active therapists. */
export function canHoldStaff(e: PracticeEntitlements, staffCount: number, therapistCount: number): boolean {
  if (staffCount > 0 && e.staffInviteRoles.length === 0) return false;
  if (therapistCount > 1 && !e.staffInviteRoles.includes('THERAPIST')) return false;
  return true;
}
