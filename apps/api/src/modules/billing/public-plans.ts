import { PRACTICE_ENTITLEMENTS, PROFILE_ENTITLEMENTS, TIERS, TIER_NAMES, type Tier } from '../entitlements/entitlements';
import { SUBSCRIPTION_PLANS, formatNaira, isSubscriptionTier } from './subscription-plans';

/**
 * The plans as the public pricing page shows them: name, monthly price and
 * what each includes. Built from the same tables that set the Paystack charge
 * (subscription-plans.ts) and enforce the limits (entitlements.ts), so the
 * page can never promise something different from what a practice gets.
 */
export function publicPlans() {
  return TIERS.map((tier: Tier) => {
    const paid = isSubscriptionTier(tier) ? SUBSCRIPTION_PLANS[tier] : null;
    const practice = PRACTICE_ENTITLEMENTS[tier];
    return {
      tier,
      name: TIER_NAMES[tier],
      monthlyKobo: paid?.amountKobo ?? 0,
      monthlyPrice: paid ? formatNaira(paid.amountKobo) : '₦0',
      monthlyBookingLimit: practice.monthlyBookingLimit,
      platformFeePercent: practice.platformFeeBps / 100,
      bankTransferPayments: practice.bankTransferPayments,
      customDomain: practice.customDomain,
      staffRoles: practice.staffInviteRoles,
      googleCalendarSync: practice.googleCalendarSync,
      profilePdf: PROFILE_ENTITLEMENTS[tier].downloadablePdf,
    };
  });
}
