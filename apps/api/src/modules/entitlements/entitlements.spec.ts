import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  PRACTICE_ENTITLEMENTS,
  PROFILE_ENTITLEMENTS,
  TIERS,
  canHoldStaff,
  complimentaryActive,
  effectiveTier,
  highestTier,
  instrumentAllowed,
  nextTier,
  platformFeeBps,
  platformFeeKobo,
  practiceEntitlements,
  profileEntitlementsFromTiers,
  requiredTierFor,
  requiredTierForProfile,
  requiredTierForStaffRole,
  type PlanFields,
  type PracticeFeature,
  type Tier,
} from './entitlements';
import { EntitlementsService } from './entitlements.service';
import { EntitlementError } from './entitlement.error';

const plan = (over: Partial<PlanFields> = {}): PlanFields => ({
  subscriptionTier: 'FREE',
  subscriptionStatus: null,
  complimentaryUntil: null,
  complimentaryReason: null,
  ...over,
});
const paying = (tier: Tier) => plan({ subscriptionTier: tier, subscriptionStatus: 'active' });

/** Spec §5.3, written out row by row so a change to the table is a deliberate change here too. */
const PRACTICE_TABLE: Record<Tier, Record<string, unknown>> = {
  FREE:    { monthlyBookingLimit: 10,   platformFeeBps: 500, bankTransferPayments: false, customDomain: false, staffInviteRoles: [],                                    assessmentRank: 0, googleCalendarSync: false },
  STARTER: { monthlyBookingLimit: 30,   platformFeeBps: 0,   bankTransferPayments: true,  customDomain: false, staffInviteRoles: [],                                    assessmentRank: 0, googleCalendarSync: true },
  PRO:     { monthlyBookingLimit: null, platformFeeBps: 0,   bankTransferPayments: true,  customDomain: true,  staffInviteRoles: ['ADMIN', 'RECEPTIONIST'],             assessmentRank: 1, googleCalendarSync: true },
  CLINIC:  { monthlyBookingLimit: null, platformFeeBps: 0,   bankTransferPayments: true,  customDomain: true,  staffInviteRoles: ['ADMIN', 'RECEPTIONIST', 'THERAPIST'], assessmentRank: 2, googleCalendarSync: true },
};
const PROFILE_TABLE: Record<Tier, Record<string, boolean>> = {
  FREE: { downloadablePdf: false, introVideo: false },
  STARTER: { downloadablePdf: true, introVideo: true },
  PRO: { downloadablePdf: true, introVideo: true },
  CLINIC: { downloadablePdf: true, introVideo: true },
};

describe('the plan tables', () => {
  const practiceRows = TIERS.flatMap((tier) => Object.entries(PRACTICE_TABLE[tier]).map(([k, v]) => [tier, k, v] as const));
  const profileRows = TIERS.flatMap((tier) => Object.entries(PROFILE_TABLE[tier]).map(([k, v]) => [tier, k, v] as const));

  it.each(practiceRows)('practice: %s.%s is %j', (tier, key, value) => {
    expect((PRACTICE_ENTITLEMENTS[tier] as any)[key]).toEqual(value);
  });

  it.each(profileRows)('profile: %s.%s is %j', (tier, key, value) => {
    expect((PROFILE_ENTITLEMENTS[tier] as any)[key]).toBe(value);
  });

  it('have no key the tables above do not cover', () => {
    for (const tier of TIERS) {
      expect(Object.keys(PRACTICE_ENTITLEMENTS[tier]).sort()).toEqual(Object.keys(PRACTICE_TABLE[tier]).sort());
      expect(Object.keys(PROFILE_ENTITLEMENTS[tier]).sort()).toEqual(Object.keys(PROFILE_TABLE[tier]).sort());
    }
  });

  it.each([
    ['bankTransferPayments', 'STARTER'],
    ['googleCalendarSync', 'STARTER'],
    ['customDomain', 'PRO'],
  ] as Array<[PracticeFeature, Tier]>)('%s first comes with %s', (feature, tier) => {
    expect(requiredTierFor(feature)).toBe(tier);
  });

  it('profile features first come with Starter', () => {
    expect(requiredTierForProfile('downloadablePdf')).toBe('STARTER');
    expect(requiredTierForProfile('introVideo')).toBe('STARTER');
  });

  it('needs Clinic for therapist invites and Pro for admins and receptionists', () => {
    expect(requiredTierForStaffRole('THERAPIST')).toBe('CLINIC');
    expect(requiredTierForStaffRole('ADMIN')).toBe('PRO');
    expect(requiredTierForStaffRole('RECEPTIONIST')).toBe('PRO');
  });

  it('upgrades walk free → Starter → Pro and never skip to Clinic', () => {
    expect(nextTier('FREE')).toBe('STARTER');
    expect(nextTier('STARTER')).toBe('PRO');
    expect(nextTier('PRO')).toBe('CLINIC');
    expect(nextTier('CLINIC')).toBeNull();
  });
});

describe('effectiveTier', () => {
  const now = new Date('2026-11-01T12:00:00Z');

  it.each([null, '', 'bogus', 'free'])('stored %j reads as FREE, so nothing unrecognised gets a paid plan', (stored) => {
    expect(effectiveTier(paying('PRO' as Tier) && plan({ subscriptionTier: stored, subscriptionStatus: 'active' }), now)).toBe('FREE');
  });

  it('is FREE for no tenant at all', () => {
    expect(effectiveTier(null, now)).toBe('FREE');
  });

  it.each(['active', 'past_due', 'cancelled'])('keeps a paid plan while Paystack says %s (cancelled lapses through §5.4a)', (status) => {
    expect(effectiveTier(plan({ subscriptionTier: 'PRO', subscriptionStatus: status }), now)).toBe('PRO');
  });

  it.each([null, 'unpaid'])('treats a paid tier with no subscription (%j) and no complimentary plan as FREE', (status) => {
    expect(effectiveTier(plan({ subscriptionTier: 'PRO', subscriptionStatus: status }), now)).toBe('FREE');
  });

  it('honours a complimentary period until it ends, and not after', () => {
    expect(effectiveTier(plan({ subscriptionTier: 'PRO', complimentaryUntil: new Date('2026-11-02'), complimentaryReason: 'INVITE_CODE' }), now)).toBe('PRO');
    expect(effectiveTier(plan({ subscriptionTier: 'PRO', complimentaryUntil: new Date('2026-11-01T11:00:00Z'), complimentaryReason: 'INVITE_CODE' }), now)).toBe('FREE');
  });

  it('treats INTERNAL with no end date as active, for ever', () => {
    const internal = plan({ subscriptionTier: 'CLINIC', complimentaryReason: 'INTERNAL' });
    expect(complimentaryActive(internal, new Date('2040-01-01'))).toBe(true);
    expect(effectiveTier(internal, new Date('2040-01-01'))).toBe('CLINIC');
  });

  it('does not treat a null end date as complimentary for any other reason', () => {
    expect(effectiveTier(plan({ subscriptionTier: 'PRO', complimentaryReason: 'MIGRATION' }), now)).toBe('FREE');
  });

  it('reads Starter on a migration period as Starter', () => {
    expect(practiceEntitlements(plan({ subscriptionTier: 'STARTER', complimentaryUntil: new Date('2027-01-01'), complimentaryReason: 'MIGRATION' }), now)).toBe(PRACTICE_ENTITLEMENTS.STARTER);
  });
});

describe('profile scope', () => {
  it.each([
    [[], 'FREE'],
    [['FREE'], 'FREE'],
    [['FREE', 'PRO'], 'PRO'],
    [['STARTER', 'CLINIC', 'PRO'], 'CLINIC'],
  ] as Array<[Tier[], Tier]>)('the best of %j is %s', (tiers, best) => {
    expect(highestTier(tiers)).toBe(best);
    expect(profileEntitlementsFromTiers(tiers)).toBe(PROFILE_ENTITLEMENTS[best]);
  });
});

describe('assessments', () => {
  it.each([
    ['FREE', 'STARTER', true], ['FREE', 'PRO', false],
    ['STARTER', 'STARTER', true], ['STARTER', 'PRO', false],
    ['PRO', 'PRO', true], ['PRO', 'CLINIC', false],
    ['CLINIC', 'PRO', true], ['CLINIC', 'CLINIC', true],
  ] as const)('%s may use an instrument saved as %s: %s', (tier, needed, expected) => {
    expect(instrumentAllowed(PRACTICE_ENTITLEMENTS[tier], needed)).toBe(expected);
  });
});

describe('platform fee', () => {
  it.each([
    ['FREE', 1_000_000n, 50_000n],
    ['FREE', 999_999n, 50_000n],
    ['FREE', 7n, 0n],
    ['STARTER', 1_000_000n, 0n],
    ['PRO', 1_000_000n, 0n],
  ] as const)('%s on %s kobo is %s', (tier, amount, fee) => {
    expect(platformFeeKobo(PRACTICE_ENTITLEMENTS[tier].platformFeeBps, amount)).toBe(fee);
  });

  it('is looked up explicitly, in basis points', () => {
    expect(platformFeeBps(plan())).toBe(500);
    expect(platformFeeBps(paying('STARTER'))).toBe(0);
  });
});

describe('staff a plan can hold', () => {
  it.each([
    ['FREE', 0, 1, true], ['FREE', 1, 1, false],
    ['STARTER', 1, 1, false],
    ['PRO', 2, 1, true], ['PRO', 2, 2, false],
    ['CLINIC', 5, 4, true],
  ] as const)('%s with %i staff and %i therapists: %s', (tier, staff, therapists, ok) => {
    expect(canHoldStaff(PRACTICE_ENTITLEMENTS[tier], staff, therapists)).toBe(ok);
  });
});

describe('EntitlementsService', () => {
  function makeService(tenant: PlanFields | null, bookings = 0, memberships: Array<{ tenant: PlanFields }> = []) {
    const prisma: any = {
      tenant: { findUnique: vi.fn().mockResolvedValue(tenant) },
      consultBooking: { count: vi.fn().mockResolvedValue(bookings) },
      profile: { findMany: vi.fn().mockResolvedValue(memberships) },
    };
    return { service: new EntitlementsService(prisma), prisma };
  }

  it('assertPractice throws a 402 naming the scope, feature and the plan that includes it', async () => {
    const { service } = makeService(paying('STARTER'));
    const err = await service.assertPractice(1n, 'customDomain').catch((e) => e);
    expect(err).toBeInstanceOf(EntitlementError);
    expect(err.getStatus()).toBe(402);
    expect(err.getResponse()).toMatchObject({ code: 'ENTITLEMENT_REQUIRED', scope: 'practice', feature: 'customDomain', requiredTier: 'PRO' });
  });

  it('assertPractice passes when the plan includes it', async () => {
    const { service } = makeService(paying('PRO'));
    await expect(service.assertPractice(1n, 'customDomain')).resolves.toBeUndefined();
  });

  it('summarises the plan, the next plan up and the month so far', async () => {
    const { service } = makeService(plan(), 10);
    expect(await service.summary(1n)).toMatchObject({
      tier: 'FREE',
      upgradeTo: 'STARTER',
      upgradeToName: 'Starter',
      entitlements: { monthlyBookingLimit: 10, platformFeeBps: 500 },
      usage: { bookingsThisMonth: 10, bookingLimitReached: true },
    });
  });

  it('does not count bookings on unlimited plans', async () => {
    const { service, prisma } = makeService(paying('PRO'));
    expect((await service.summary(1n)).usage).toEqual({ bookingsThisMonth: null, bookingLimitReached: false });
    expect(prisma.consultBooking.count).not.toHaveBeenCalled();
  });

  describe('profile entitlements for a person (§5.1)', () => {
    it('ask only for active OWNER/THERAPIST memberships in open practices', async () => {
      const { service, prisma } = makeService(null);
      await service.forProfile(5n);
      expect(prisma.profile.findMany.mock.calls[0][0].where).toEqual({
        userId: 5n,
        status: 'active',
        role: { in: ['OWNER', 'THERAPIST'] },
        tenant: { isActive: true, closureRequestedAt: null },
      });
    });

    it('a solo owner on Starter gets the PDF', async () => {
      const { service } = makeService(null, 0, [{ tenant: paying('STARTER') }]);
      expect(await service.forProfile(5n)).toBe(PROFILE_ENTITLEMENTS.STARTER);
    });

    it('a therapist at a Clinic gets Clinic profile features', async () => {
      const { service } = makeService(null, 0, [{ tenant: paying('CLINIC') }]);
      expect(await service.forProfile(5n)).toBe(PROFILE_ENTITLEMENTS.CLINIC);
    });

    it('no qualifying membership (e.g. a receptionist at a Pro practice, filtered out by the query) → FREE', async () => {
      const { service } = makeService(null, 0, []);
      expect(await service.forProfile(5n)).toBe(PROFILE_ENTITLEMENTS.FREE);
    });

    it('several practices → the highest plan', async () => {
      const { service } = makeService(null, 0, [{ tenant: plan() }, { tenant: paying('PRO') }, { tenant: paying('STARTER') }]);
      expect(await service.forProfile(5n)).toBe(PROFILE_ENTITLEMENTS.PRO);
    });

    it('assertProfile throws a 402 with the profile scope', async () => {
      const { service } = makeService(null, 0, []);
      const err = await service.assertProfile(5n, 'downloadablePdf').catch((e) => e);
      expect(err.getResponse()).toMatchObject({ scope: 'profile', feature: 'downloadablePdf', requiredTier: 'STARTER' });
    });
  });
});

/*
 * The point of the module: plan gating lives here and only here. A tier
 * compared with a string, or `subscriptionTier` read directly, anywhere else
 * in the API is a gate that will drift from these tables, so it fails the
 * build. Writing the tier (billing webhooks, invite codes, the lapse timeline)
 * is fine: `subscriptionTier: plan` in an update is not a read.
 */
describe('no tier comparisons or subscriptionTier reads outside the entitlements module', () => {
  const SRC = join(__dirname, '..', '..');
  const HERE = __dirname;
  const PLAN = `(FREE|STARTER|PRO|CLINIC)`;
  const PATTERNS = [
    new RegExp(`['"\`]${PLAN}['"\`]\\s*[!=]==?`),
    new RegExp(`[!=]==?\\s*['"\`]${PLAN}['"\`]`),
    new RegExp(`case\\s+['"\`]${PLAN}['"\`]\\s*:`),
    new RegExp(`\\.includes\\(\\s*['"\`]${PLAN}['"\`]\\s*\\)`),
    /\.subscriptionTier\b/,
    /subscriptionTier\s*:\s*true/,
    /subscriptionTier\s*\|\|/,
    /\btierIncludes\b/,
  ];

  /** Code that writes the tier and reports what it wrote. */
  const WRITERS = new Set(['modules/billing/internal-tenant.ts']);

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return path === HERE ? [] : files(path);
      return name.endsWith('.ts') && !name.endsWith('.spec.ts') && !WRITERS.has(relative(SRC, path)) ? [path] : [];
    });
  }

  it('finds none', () => {
    const offenders = files(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .filter(({ line }) => PATTERNS.some((p) => p.test(line)))
        .map(({ line, i }) => `${relative(SRC, file)}:${i + 1}: ${line.trim()}`),
    );
    expect(offenders, 'gate on practiceEntitlements()/effectiveTier() from modules/entitlements instead').toEqual([]);
  });

  it.each([
    "if (tenant.subscriptionTier === 'STARTER') {",
    "const fee = tier === 'STARTER' ? 5 : 0;",
    "if ('PRO' !== plan) return;",
    "case 'CLINIC':",
    "PAID.includes('FREE')",
    'select: { subscriptionTier: true },',
    "const tier = tenant.subscriptionTier || 'STARTER';",
  ])('would catch %j', (line) => {
    expect(PATTERNS.some((p) => p.test(line))).toBe(true);
  });

  it.each(["data: { subscriptionTier: 'FREE' },", "label: 'Starter'"])('lets %j through (a write or a label, not a read)', (line) => {
    expect(PATTERNS.some((p) => p.test(line))).toBe(false);
  });
});
