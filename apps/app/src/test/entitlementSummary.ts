import type { EntitlementSummary } from '../utils/entitlements';

const REQUIRED = { bankTransferPayments: 'STARTER', customDomain: 'PRO', googleCalendarSync: 'STARTER', staff: 'PRO', therapists: 'CLINIC' } as const;
/** An entitlements response for tests: a FREE practice unless `over` says otherwise. */
export const summary = (over: Partial<EntitlementSummary['entitlements']> = {}): EntitlementSummary => ({
  tier: 'FREE',
  tierName: 'Free',
  upgradeTo: 'STARTER',
  upgradeToName: 'Starter',
  entitlements: {
    monthlyBookingLimit: 10,
    platformFeeBps: 500,
    bankTransferPayments: false,
    customDomain: false,
    staffInviteRoles: [],
    assessmentRank: 0,
    googleCalendarSync: false,
    ...over,
  },
  requiredTiers: { ...REQUIRED },
  usage: { bookingsThisMonth: 0, bookingLimitReached: false },
});
