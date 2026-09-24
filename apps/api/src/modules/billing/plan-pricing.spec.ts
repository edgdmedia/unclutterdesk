import { describe, it, expect, vi } from 'vitest';
import { BillingService } from './billing.service';
import { SUBSCRIPTION_PLANS, formatNaira } from './subscription-plans';

/**
 * What a plan costs.
 *
 * The in-app upgrade page wrote its own prices and got all three wrong: Pro was
 * offered at ₦25,000 and Group Clinic at ₦75,000 while Paystack was charging
 * ₦15,000 and ₦45,000, and Starter was shown as free when it is not. The
 * marketing site quoted the real figures, so a practice saw one price on the
 * pricing page and a different one on the button they clicked to buy.
 *
 * Undercharging was the lucky direction. The fix is that no surface restates a
 * price: this endpoint derives them from the same definitions the charge is
 * built from.
 */
function makeService() {
  // listPlans reads only the static plan definitions, so no dependency is used.
  return new BillingService({} as any, {} as any, {} as any);
}

describe('the advertised plans', () => {
  it('offers every tier', () => {
    const plans = makeService().listPlans();
    expect(plans.map((p) => p.tier).sort()).toEqual(['CLINIC', 'PRO', 'STARTER']);
  });

  it('prices each one from the figure that is charged', () => {
    for (const plan of makeService().listPlans()) {
      expect(plan.amountKobo).toBe(SUBSCRIPTION_PLANS[plan.tier].amountKobo);
      expect(plan.price).toBe(formatNaira(SUBSCRIPTION_PLANS[plan.tier].amountKobo));
    }
  });

  // The three figures the page used to show.
  it('does not quote the prices the upgrade page invented', () => {
    const quoted = makeService().listPlans().map((p) => p.price);
    expect(quoted).not.toContain('₦25,000');
    expect(quoted).not.toContain('₦75,000');
    expect(quoted).not.toContain('₦0');
  });

  it('quotes naira, from kobo, without rounding a real amount away', () => {
    const pro = makeService().listPlans().find((p) => p.tier === 'PRO')!;
    expect(pro.amountKobo % 100).toBe(0);
    expect(pro.price).toBe(`₦${(pro.amountKobo / 100).toLocaleString('en-NG')}`);
  });

  it('carries a name for each plan rather than leaving the page to invent one', () => {
    for (const plan of makeService().listPlans()) {
      expect(plan.name.length).toBeGreaterThan(0);
    }
  });
});
