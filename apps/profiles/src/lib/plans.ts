import type { ProfilesConfig } from './config';

/** One plan, as GET /v1/billing/public-plans returns it (apps/api public-plans.ts). */
export interface Plan {
  tier: 'FREE' | 'STARTER' | 'PRO' | 'CLINIC';
  name: string;
  monthlyKobo: number;
  monthlyPrice: string;
  monthlyBookingLimit: number | null;
  platformFeePercent: number;
  bankTransferPayments: boolean;
  customDomain: boolean;
  staffRoles: string[];
  googleCalendarSync: boolean;
  profilePdf: boolean;
}

/** The plans from the API: the same tables that set the charge and the limits. No credentials are sent. */
export async function fetchPlans(config: ProfilesConfig, fetchImpl: typeof fetch = fetch): Promise<Plan[]> {
  const res = await fetchImpl(`${config.apiOrigin}/v1/billing/public-plans`, { headers: { accept: 'application/json' }, redirect: 'manual' });
  if (!res.ok) throw new Error(`Plans API answered ${res.status}`);
  const plans = (await res.json()) as Plan[];
  if (!Array.isArray(plans) || plans.length === 0) throw new Error('Plans API returned no plans');
  return plans;
}

/** What each plan includes, in plain words, from its entitlements. Every plan includes the free profile. */
export function planFeatures(plan: Plan): string[] {
  const roles = plan.staffRoles.map((r) => r.toLowerCase());
  return [
    'Your therapist profile and link',
    plan.monthlyBookingLimit === null ? 'Unlimited online bookings' : `Up to ${plan.monthlyBookingLimit} online bookings a month`,
    plan.platformFeePercent > 0 ? `${plan.platformFeePercent}% fee on paid bookings` : 'No fee on bookings',
    plan.bankTransferPayments ? 'Card and bank transfer payments' : 'Card payments through Paystack',
    ...(plan.profilePdf ? ['Profile PDF to print or attach'] : []),
    ...(plan.googleCalendarSync ? ['Google Calendar sync'] : []),
    ...(plan.customDomain ? ['Your own domain'] : []),
    ...(roles.includes('therapist') ? ['A team of therapists'] : []),
    ...(roles.length ? [`Logins for ${roles.filter((r) => r !== 'therapist').join(' and ')} staff`] : []),
  ];
}

/** One line under the plan name. */
export const PLAN_BLURBS: Record<Plan['tier'], string> = {
  FREE: 'A professional profile and online booking, free.',
  STARTER: 'For a solo practitioner taking regular bookings.',
  PRO: 'For a growing practice with its own brand and front desk.',
  CLINIC: 'For a clinic with a team of therapists.',
};
