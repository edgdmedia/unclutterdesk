import { describe, expect, it } from 'vitest';
import { PRACTICE_ENTITLEMENTS, TIERS } from '../entitlements/entitlements';
import { publicPlans } from './public-plans';
import { SUBSCRIPTION_PLANS } from './subscription-plans';

describe('public plans (pricing page)', () => {
  it('lists every tier, Free first, with the price that is charged and the limits that are enforced', () => {
    const plans = publicPlans();
    expect(plans.map((p) => p.tier)).toEqual(TIERS);
    expect(plans[0]).toMatchObject({ tier: 'FREE', monthlyKobo: 0, monthlyPrice: '₦0' });
    for (const p of plans) {
      if (p.tier !== 'FREE') expect(p.monthlyKobo).toBe(SUBSCRIPTION_PLANS[p.tier].amountKobo);
      expect(p.monthlyBookingLimit).toBe(PRACTICE_ENTITLEMENTS[p.tier].monthlyBookingLimit);
      expect(p.platformFeePercent).toBe(PRACTICE_ENTITLEMENTS[p.tier].platformFeeBps / 100);
    }
  });

  it('says nothing about Paystack plan codes', () => {
    expect(JSON.stringify(publicPlans())).not.toMatch(/PLN_|planCode/);
  });
});
