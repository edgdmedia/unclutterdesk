import { describe, expect, it, vi } from 'vitest';
import { profilesConfig } from '../config';
import { fetchPlans, planFeatures, type Plan } from '../plans';

const base: Plan = {
  tier: 'FREE', name: 'Free', monthlyKobo: 0, monthlyPrice: '₦0', monthlyBookingLimit: 10, platformFeePercent: 5,
  bankTransferPayments: false, customDomain: false, staffRoles: [], googleCalendarSync: false, profilePdf: false,
};

describe('plans', () => {
  it('describes a plan from its entitlements only', () => {
    expect(planFeatures(base)).toEqual([
      'Your therapist profile and link', 'Up to 10 online bookings a month', '5% fee on paid bookings', 'Card payments through Paystack',
    ]);
    const clinic = planFeatures({ ...base, tier: 'CLINIC', monthlyBookingLimit: null, platformFeePercent: 0, bankTransferPayments: true, customDomain: true, staffRoles: ['ADMIN', 'RECEPTIONIST', 'THERAPIST'], googleCalendarSync: true, profilePdf: true });
    expect(clinic).toContain('Unlimited online bookings');
    expect(clinic).toContain('No fee on bookings');
    expect(clinic).toContain('A team of therapists');
    expect(clinic).toContain('Logins for admin and receptionist staff');
  });

  it('reads the plans from the API with no credentials, and fails loudly on a bad answer', async () => {
    const config = profilesConfig({ API_URL: 'https://api.example.test' });
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify([base]), { status: 200 }));
    await expect(fetchPlans(config, ok)).resolves.toEqual([base]);
    expect(ok.mock.calls[0][0]).toBe('https://api.example.test/v1/billing/plans');
    expect(ok.mock.calls[0][1].credentials).toBeUndefined();
    await expect(fetchPlans(config, vi.fn().mockResolvedValue(new Response('[]', { status: 200 })))).rejects.toThrow();
    await expect(fetchPlans(config, vi.fn().mockResolvedValue(new Response('', { status: 500 })))).rejects.toThrow();
  });
});
