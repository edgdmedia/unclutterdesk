import { useState } from 'react';
import { Bell, CalendarCheck, ClipboardList, CreditCard, FileText, Video, type LucideIcon } from 'lucide-react';
import { Button } from '@unclutterdesk/ui';
import { useOptionalAuth } from '../../../context/AuthContext';
import { useEntitlements } from '../../../utils/entitlements';
import { useStartBookingSetup } from './useStartBookingSetup';

const dismissKey = (tenantId: string) => `booking-nudge-dismissed:${tenantId}`;

function readDismissed(tenantId: string | undefined): boolean {
  if (!tenantId) return false;
  try {
    return localStorage.getItem(dismissKey(tenantId)) === '1';
  } catch {
    return false;
  }
}

const GAINS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CalendarCheck, title: 'Clients book from your profile', body: 'A Book button on your page. They pick a time that suits you, with no back-and-forth messages.' },
  { icon: CreditCard, title: 'Paid before the session', body: 'Card payments through Paystack, in naira, settled straight to your bank account.' },
  { icon: Bell, title: 'Reminders sent for you', body: 'Clients get confirmations and reminders by email, so fewer sessions are missed.' },
  { icon: ClipboardList, title: 'Intake before the first hello', body: 'Ready-made intake and consent forms, ready to send with each new booking.' },
  { icon: Video, title: 'Secure video sessions', body: 'Every online booking comes with its own session link. Nothing for clients to install.' },
  { icon: FileText, title: 'Notes and records in one place', body: 'Session notes, forms and assessments kept together with each client.' },
];

const STEPS = ['Set your hours', 'Add your services and fees', 'Connect your bank for payouts'];

/**
 * §6.8: once a profile-first therapist has published, sell booking properly,
 * once, without blocking anything. "Set up booking" switches the practice to
 * the full dashboard and opens the set-up steps; "Not now" hides it on this
 * device. Plan details come from the entitlements response, never hard-coded.
 */
export function BookingNudge({ published }: { published: boolean }) {
  const auth = useOptionalAuth();
  const tenantId = auth?.profile?.tenantId ?? undefined;
  const eligible = published && auth?.profile?.onboardingIntent === 'PROFILE';
  const plan = useEntitlements(eligible);
  const [dismissed, setDismissed] = useState(() => readDismissed(tenantId));
  const { start, busy } = useStartBookingSetup();

  if (!eligible || dismissed) return null;

  function notNow() {
    try {
      if (tenantId) localStorage.setItem(dismissKey(tenantId), '1');
    } catch {
      // Storage blocked: the card simply comes back next time.
    }
    setDismissed(true);
  }

  const limit = plan?.entitlements.monthlyBookingLimit;
  const fee = plan ? plan.entitlements.platformFeeBps / 100 : null;
  const planLine = plan
    ? [
        `Included in your ${plan.tierName} plan`,
        limit === null ? 'unlimited bookings' : `up to ${limit} bookings a month`,
        fee ? `${fee}% fee on paid bookings` : 'no booking fee',
      ].join(' · ')
    : null;

  return (
    <section
      aria-labelledby="booking-nudge-title"
      className="rounded-[24px] overflow-hidden border border-[var(--desk-pine-200)] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
    >
      <div className="bg-[var(--desk-sidebar)] text-white px-6 py-6 md:px-8 md:py-7 flex flex-col gap-2">
        <span className="text-[9px] font-black tracking-[0.22em] uppercase text-[var(--desk-pine-300)]">Your profile is live · Next step</span>
        <h2 id="booking-nudge-title" className="text-[24px] md:text-[28px] font-extrabold tracking-[-0.03em] leading-tight">
          Turn profile visits into booked, paid sessions
        </h2>
        <p className="text-[14.5px] leading-relaxed text-[var(--desk-pine-200)] max-w-[640px]">
          Right now clients can read about you, then have to find a way to reach you. Switch on booking and they can choose a time, pay and
          fill in their intake form without leaving your page. Everything below is already set up and waiting.
        </p>
      </div>

      <div className="px-6 py-6 md:px-8 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {GAINS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <span className="h-10 w-10 shrink-0 rounded-[12px] bg-[var(--desk-pine-100)] text-[var(--desk-pine-600)] flex items-center justify-center" aria-hidden>
              <Icon size={18} />
            </span>
            <div>
              <h3 className="text-[14.5px] font-bold text-[var(--desk-text)]">{title}</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--desk-text-body)]">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-6 md:mx-8 mb-6 rounded-[18px] bg-[var(--desk-pine-050)] px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[13px] font-bold text-[var(--desk-pine-800)]">About 5 minutes to set up</p>
          <ol className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--desk-text-body)]">
            {STEPS.map((s, i) => (
              <li key={s}>
                <span className="font-bold text-[var(--desk-pine-600)]">{i + 1}.</span> {s}
              </li>
            ))}
          </ol>
          {planLine && <p className="mt-2 text-[12.5px] text-[var(--desk-text-body)]">{planLine}</p>}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button onClick={() => void start()} disabled={busy}>{busy ? 'Switching on…' : 'Set up booking'}</Button>
          <Button variant="ghost" onClick={notNow} disabled={busy}>Not now</Button>
        </div>
      </div>
    </section>
  );
}
