/**
 * Platform subscription plans, priced in kobo.
 *
 * Amounts live here rather than in the display code so the price a practice is
 * charged and the price it is shown cannot drift apart.
 *
 * `planCodeEnv` names the environment variable holding the Paystack plan code
 * (`PLN_xxxx`). Plans are created once in the Paystack dashboard — they are not
 * created on the fly, because a plan created per request would fragment billing
 * across duplicate plans.
 */
export type SubscriptionTier = 'STARTER' | 'PRO' | 'CLINIC';

export interface PlanDefinition {
  tier: SubscriptionTier;
  name: string;
  amountKobo: number;
  planCodeEnv: string;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, PlanDefinition> = {
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    amountKobo: 500_000, // ₦5,000
    planCodeEnv: 'PAYSTACK_PLAN_STARTER',
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    amountKobo: 1_500_000, // ₦15,000
    planCodeEnv: 'PAYSTACK_PLAN_PRO',
  },
  CLINIC: {
    tier: 'CLINIC',
    name: 'Clinic',
    amountKobo: 4_500_000, // ₦45,000
    planCodeEnv: 'PAYSTACK_PLAN_CLINIC',
  },
};

export const SUBSCRIPTION_TIERS = Object.keys(SUBSCRIPTION_PLANS) as SubscriptionTier[];

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return typeof value === 'string' && SUBSCRIPTION_TIERS.includes(value as SubscriptionTier);
}

/** Naira, formatted for display. Derived from the same figure that is charged. */
export function formatNaira(amountKobo: number): string {
  return `₦${(amountKobo / 100).toLocaleString('en-NG')}`;
}

export function planCodeFor(tier: SubscriptionTier): string | undefined {
  const code = process.env[SUBSCRIPTION_PLANS[tier].planCodeEnv];
  return code && code.trim() ? code.trim() : undefined;
}
