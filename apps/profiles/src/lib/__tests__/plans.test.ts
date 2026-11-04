import { describe, expect, it, vi } from 'vitest';
import { profilesConfig } from '../config';
import { fetchPlans, planFeatures, planHighlights, type Plan } from '../plans';

const base: Plan = {
  tier: 'FREE', name: 'Free', monthlyKobo: 0, monthlyPrice: '₦0', monthlyBookingLimit: 10, platformFeePercent: 5,
  bankTransferPayments: false, customDomain: false, staffRoles: [], googleCalendarSync: false, profilePdf: false,
};

describe('plans', () => {
  it('describes a plan from its entitlements only', () => {
    expect(planFeatures({ ...base, assessments: ['PHQ-9', 'GAD-7'] })).toEqual([
      'Professional profile, link and QR code', 'Up to 10 bookings a month', 'Paystack payments (5% platform fee)', 'Notes, intake, PHQ-9 and GAD-7',
    ]);
    const clinic = planFeatures({ ...base, tier: 'CLINIC', monthlyBookingLimit: null, platformFeePercent: 0, bankTransferPayments: true, customDomain: true, staffRoles: ['ADMIN', 'RECEPTIONIST', 'THERAPIST'], googleCalendarSync: true, profilePdf: true });
    expect(clinic).toContain('Unlimited bookings');
    expect(clinic).toContain('0% platform fee');
    expect(clinic).toContain('Several therapists');
    expect(clinic).toContain('Admin and reception staff');
  });

  it('lists each plan as "Everything in <the plan before>" plus only what it adds', () => {
    const free = { ...base, assessments: ['PHQ-9', 'GAD-7'] };
    const starter: Plan = { ...free, tier: 'STARTER', name: 'Starter', monthlyBookingLimit: 30, platformFeePercent: 0, bankTransferPayments: true, profilePdf: true, introVideo: true };
    const pro: Plan = { ...starter, tier: 'PRO', name: 'Pro', monthlyBookingLimit: null, customDomain: true, staffRoles: ['ADMIN', 'RECEPTIONIST'], assessments: ['PHQ-9', 'GAD-7', 'PCL-5', 'DASS-21'] };
    const [f, s, p] = planHighlights([free, starter, pro]);
    expect(f).toEqual(planFeatures(free));
    expect(s).toEqual(['Everything in Free', 'Up to 30 bookings a month', '0% platform fee', 'Bank transfer payments', 'Profile PDF and intro video']);
    expect(p).toEqual(['Everything in Starter', 'Unlimited bookings', 'Your own domain', 'Admin and reception staff', 'PCL-5 and DASS-21']);
  });

  it('reads the plans from the API with no credentials, and fails loudly on a bad answer', async () => {
    const config = profilesConfig({ API_URL: 'https://api.example.test' });
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify([base]), { status: 200 }));
    await expect(fetchPlans(config, ok)).resolves.toEqual([base]);
    expect(ok.mock.calls[0][0]).toBe('https://api.example.test/v1/billing/public-plans');
    expect(ok.mock.calls[0][1].credentials).toBeUndefined();
    await expect(fetchPlans(config, vi.fn().mockResolvedValue(new Response('[]', { status: 200 })))).rejects.toThrow();
    await expect(fetchPlans(config, vi.fn().mockResolvedValue(new Response('', { status: 500 })))).rejects.toThrow();
  });
});
