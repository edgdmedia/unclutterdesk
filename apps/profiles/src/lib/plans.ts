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
  introVideo?: boolean;
  customBrandColor?: boolean;
  /** Scored assessments the plan includes (PHQ-9, GAD-7, …). */
  assessments?: string[];
}

/** The plans from the API: the same tables that set the charge and the limits. No credentials are sent. */
export async function fetchPlans(config: ProfilesConfig, fetchImpl: typeof fetch = fetch): Promise<Plan[]> {
  const res = await fetchImpl(`${config.apiOrigin}/v1/billing/public-plans`, { headers: { accept: 'application/json' }, redirect: 'manual' });
  if (!res.ok) throw new Error(`Plans API answered ${res.status}`);
  const plans = (await res.json()) as Plan[];
  if (!Array.isArray(plans) || plans.length === 0) throw new Error('Plans API returned no plans');
  return plans;
}

const join = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What each plan includes, in plain words, from its entitlements. */
export function planFeatures(plan: Plan): string[] {
  const roles = plan.staffRoles.map((r) => r.toLowerCase());
  const staff = roles.filter((r) => r !== 'therapist').map((r) => (r === 'receptionist' ? 'reception' : r));
  return [
    'Professional profile, link and QR code',
    plan.monthlyBookingLimit === null ? 'Unlimited bookings' : `Up to ${plan.monthlyBookingLimit} bookings a month`,
    plan.platformFeePercent > 0 ? `Paystack payments (${plan.platformFeePercent}% platform fee)` : '0% platform fee',
    ...(plan.bankTransferPayments ? ['Bank transfer payments'] : []),
    ...(plan.googleCalendarSync ? ['Google Calendar sync'] : []),
    ...(plan.profilePdf && plan.introVideo ? ['Profile PDF and intro video'] : plan.profilePdf ? ['Profile PDF'] : []),
    ...(plan.customBrandColor ? ['Your own brand colour'] : []),
    ...(plan.customDomain ? ['Your own domain'] : []),
    `Notes, intake${plan.assessments?.length ? `, ${join(plan.assessments)}` : ''}`,
    ...(staff.length ? [`${join(staff.map((r, i) => (i === 0 ? r[0].toUpperCase() + r.slice(1) : r)))} staff`] : []),
    ...(roles.includes('therapist') ? ['Several therapists'] : []),
  ];
}

/**
 * The home page's plan cards: the first plan lists everything; each plan
 * after it says "Everything in <the one before>" and only what it adds.
 * All from the plans' own data, so the cards follow any change to a plan.
 */
export function planHighlights(plans: Plan[]): string[][] {
  return plans.map((plan, i) => {
    const mine = planFeatures(plan);
    if (i === 0) return mine;
    const before = planFeatures(plans[i - 1]);
    // Assessments: name only the ones this plan adds.
    const added = (plan.assessments ?? []).filter((a) => !(plans[i - 1].assessments ?? []).includes(a));
    const extra = mine.filter((f) => !before.includes(f) && !f.startsWith('Notes, intake'));
    return [`Everything in ${plans[i - 1].name}`, ...extra, ...(added.length ? [join(added)] : [])];
  });
}

/** One line under the plan name. */
export const PLAN_BLURBS: Record<Plan['tier'], string> = {
  FREE: 'Your profile, and booking when you want it.',
  STARTER: 'For a practice that is getting busy.',
  PRO: 'For a full, established practice.',
  CLINIC: 'For a team of therapists.',
};
