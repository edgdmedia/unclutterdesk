import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  ENTITLEMENTS,
  TIERS,
  canHoldStaff,
  effectiveTier,
  entitlementsFor,
  hasEntitlement,
  instrumentAllowed,
  nextTier,
  platformFeeKobo,
  requiredTierFor,
  requiredTierForStaffRole,
  tierOf,
  type EntitlementKey,
  type Tier,
} from './entitlements';
import { EntitlementsService } from './entitlements.service';
import { EntitlementError } from './entitlement.error';

/** Spec §5.2, written out row by row so a change to the table is a deliberate change here too. */
const PLAN_TABLE: Record<Tier, Record<string, unknown>> = {
  FREE:    { monthlyBookingLimit: 10,   platformFeeBps: 500, customDomain: false, staffInviteRoles: [],                                    assessmentRank: 0, googleCalendarSync: false, bankTransferPayments: false, downloadablePdf: false, introVideo: false },
  STARTER: { monthlyBookingLimit: 30,   platformFeeBps: 0,   customDomain: false, staffInviteRoles: [],                                    assessmentRank: 0, googleCalendarSync: true,  bankTransferPayments: true, downloadablePdf: true,  introVideo: true },
  PRO:     { monthlyBookingLimit: null, platformFeeBps: 0,   customDomain: true,  staffInviteRoles: ['ADMIN', 'RECEPTIONIST'],             assessmentRank: 1, googleCalendarSync: true,  bankTransferPayments: true,  downloadablePdf: true,  introVideo: true },
  CLINIC:  { monthlyBookingLimit: null, platformFeeBps: 0,   customDomain: true,  staffInviteRoles: ['ADMIN', 'RECEPTIONIST', 'THERAPIST'], assessmentRank: 2, googleCalendarSync: true,  bankTransferPayments: true,  downloadablePdf: true,  introVideo: true },
};

describe('the plan table', () => {
  const rows = TIERS.flatMap((tier) => Object.entries(PLAN_TABLE[tier]).map(([key, value]) => [tier, key, value] as const));

  it.each(rows)('%s.%s is %j', (tier, key, value) => {
    const e = ENTITLEMENTS[tier];
    const actual = key === 'downloadablePdf' || key === 'introVideo' ? e.profileFeatures[key] : (e as any)[key];
    expect(actual).toEqual(value);
  });

  it('has no key the table above does not cover', () => {
    for (const tier of TIERS) {
      const { profileFeatures, ...rest } = ENTITLEMENTS[tier];
      expect(Object.keys({ ...rest, ...profileFeatures }).sort()).toEqual(Object.keys(PLAN_TABLE[tier]).sort());
    }
  });

  it.each([
    ['customDomain', 'PRO'],
    ['googleCalendarSync', 'STARTER'],
    ['bankTransferPayments', 'STARTER'],
    ['downloadablePdf', 'STARTER'],
    ['introVideo', 'STARTER'],
    ['staffInviteRoles', 'PRO'],
  ] as Array<[EntitlementKey, Tier]>)('%s first comes with %s', (key, tier) => {
    expect(requiredTierFor(key)).toBe(tier);
    expect(hasEntitlement(ENTITLEMENTS[tier], key)).toBe(true);
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

describe('reading a tenant', () => {
  it.each([
    [null, 'FREE'], ['', 'FREE'], ['bogus', 'FREE'], ['starter', 'STARTER'], ['PRO', 'PRO'], ['CLINIC', 'CLINIC'],
  ])('stored %j reads as %s, so nothing unrecognised gets a paid plan', (stored, tier) => {
    expect(tierOf({ subscriptionTier: stored })).toBe(tier);
  });

  it('honours an invite-code period until it ends, and not after', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    expect(effectiveTier({ subscriptionTier: 'PRO', complimentaryUntil: new Date('2026-11-02') }, now)).toBe('PRO');
    expect(effectiveTier({ subscriptionTier: 'PRO', complimentaryUntil: new Date('2026-11-01T11:00:00Z') }, now)).toBe('FREE');
    expect(entitlementsFor({ subscriptionTier: 'PRO', complimentaryUntil: null }, now)).toBe(ENTITLEMENTS.PRO);
  });
});

describe('assessments', () => {
  it.each([
    ['FREE', 'STARTER', true], ['FREE', 'PRO', false],
    ['STARTER', 'STARTER', true], ['STARTER', 'PRO', false],
    ['PRO', 'PRO', true], ['PRO', 'CLINIC', false],
    ['CLINIC', 'PRO', true], ['CLINIC', 'CLINIC', true],
  ] as const)('%s may use an instrument on %s: %s', (tier, needed, expected) => {
    expect(instrumentAllowed(ENTITLEMENTS[tier], needed)).toBe(expected);
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
    expect(platformFeeKobo(ENTITLEMENTS[tier], amount)).toBe(fee);
  });
});

describe('staff a plan can hold', () => {
  it.each([
    ['FREE', 0, 1, true], ['FREE', 1, 1, false],
    ['STARTER', 1, 1, false],
    ['PRO', 2, 1, true], ['PRO', 2, 2, false],
    ['CLINIC', 5, 4, true],
  ] as const)('%s with %i staff and %i therapists: %s', (tier, staff, therapists, ok) => {
    expect(canHoldStaff(ENTITLEMENTS[tier], staff, therapists)).toBe(ok);
  });
});

describe('EntitlementsService', () => {
  function makeService(tenant: any, bookings = 0) {
    const prisma: any = {
      tenant: { findUnique: vi.fn().mockResolvedValue(tenant) },
      consultBooking: { count: vi.fn().mockResolvedValue(bookings) },
    };
    return { service: new EntitlementsService(prisma), prisma };
  }

  it('assert throws a 402 naming the feature and the plan that includes it', async () => {
    const { service } = makeService({ subscriptionTier: 'STARTER', complimentaryUntil: null });
    const err = await service.assert(1n, 'customDomain').catch((e) => e);
    expect(err).toBeInstanceOf(EntitlementError);
    expect(err.getStatus()).toBe(402);
    expect(err.getResponse()).toMatchObject({ code: 'ENTITLEMENT_REQUIRED', feature: 'customDomain', requiredTier: 'PRO' });
  });

  it('assert passes when the plan includes it', async () => {
    const { service } = makeService({ subscriptionTier: 'PRO', complimentaryUntil: null });
    await expect(service.assert(1n, 'customDomain')).resolves.toBeUndefined();
  });

  it('summarises the plan, the next plan up and the month so far', async () => {
    const { service } = makeService({ subscriptionTier: 'FREE', complimentaryUntil: null }, 10);
    expect(await service.summary(1n)).toMatchObject({
      tier: 'FREE',
      upgradeTo: 'STARTER',
      upgradeToName: 'Starter',
      entitlements: { monthlyBookingLimit: 10, platformFeeBps: 500 },
      usage: { bookingsThisMonth: 10, bookingLimitReached: true },
    });
  });

  it('does not count bookings on unlimited plans', async () => {
    const { service, prisma } = makeService({ subscriptionTier: 'PRO', complimentaryUntil: null });
    expect((await service.summary(1n)).usage).toEqual({ bookingsThisMonth: null, bookingLimitReached: false });
    expect(prisma.consultBooking.count).not.toHaveBeenCalled();
  });
});

/*
 * The point of the module: plan gating lives here and only here. A tier
 * compared with a string anywhere else in the API is a gate that will drift
 * from this table, so it fails the build.
 */
describe('no tier comparisons outside the entitlements module', () => {
  const SRC = join(__dirname, '..', '..');
  const HERE = __dirname;
  const PATTERNS = [
    /subscriptionTier\s*[!=]==?\s*['"`]/,
    /['"`](FREE|STARTER|PRO|CLINIC)['"`]\s*[!=]==?/,
    /\b\w*(tier|Tier|plan|Plan)\s*[!=]==?\s*['"`](FREE|STARTER|PRO|CLINIC)['"`]/,
    /subscriptionTier\s*\|\|\s*['"`]/,
    /\btierIncludes\b/,
  ];

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return path === HERE ? [] : files(path);
      return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
    });
  }

  it('finds none', () => {
    const offenders = files(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => PATTERNS.some((p) => p.test(line)))
        .map(({ line, i }) => `${relative(SRC, file)}:${i + 1}: ${line.trim()}`),
    );
    expect(offenders, 'gate on entitlementsFor(...) from modules/entitlements instead').toEqual([]);
  });

  it('would catch the old style', () => {
    expect(PATTERNS.some((p) => p.test("if (tenant.subscriptionTier === 'STARTER') {"))).toBe(true);
    expect(PATTERNS.some((p) => p.test("const fee = tier === 'STARTER' ? 5 : 0;"))).toBe(true);
  });
});
