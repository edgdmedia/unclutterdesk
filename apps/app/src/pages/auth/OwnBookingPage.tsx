import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck, CreditCard, Loader2, NotebookPen } from 'lucide-react';
import { AuthCardShell } from '../../components/AuthCardShell';
import { useAuth } from '../../context/AuthContext';

/**
 * §6.14 "Set up your own booking in one step". A therapist whose last place on
 * their profile has gone gets an email with a single-use link to this page.
 * Nothing happens until they choose to: the button creates their own free
 * practice (or finds the one they already own), signs them in, and takes them
 * to the booking set-up. They may have no practice they can sign in to, so the
 * link itself is the credential.
 */
const INCLUDED = [
  { icon: CalendarCheck, text: 'Clients book from your profile, with reminders' },
  { icon: CreditCard, text: 'Payments through Paystack' },
  { icon: NotebookPen, text: 'Intake forms, notes and your session history' },
];

export function OwnBookingPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { claimOwnBooking } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // A ref, not state: two clicks in the same tick must still send the link once.
  const sent = useRef(false);

  async function start() {
    if (sent.current) return;
    sent.current = true;
    setBusy(true);
    setError('');
    try {
      const { createdPractice } = await claimOwnBooking(token);
      navigate(createdPractice ? '/onboarding' : '/dashboard/profile', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
      // The link is single use: a failed claim may already have used it, so
      // the way forward is signing in, not trying the same link again.
    }
  }

  return (
    <AuthCardShell
      variant="verify"
      accent="green"
      footer={
        <Link to="/login" className="text-[13.5px] font-semibold text-[var(--desk-text-muted)] hover:text-[var(--desk-pine-600)]">
          Sign in instead
        </Link>
      }
    >
      <h1 className="mt-[26px] text-[25px] font-bold tracking-[-0.03em] text-[var(--desk-text)]">Set up your own booking</h1>
      <p className="mt-2 text-sm text-[var(--desk-text-muted)] leading-[1.6]">
        Your profile doesn't book through a practice any more. In one step, get your own free practice, ready for your profile.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {INCLUDED.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-[14px] font-medium text-[var(--desk-text)]">
            <span className="w-9 h-9 flex-none rounded-[11px] bg-[var(--desk-active-bg)] text-[var(--desk-active)] inline-flex items-center justify-center">
              <Icon className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-[var(--desk-text-subtle)] leading-[1.5]">
        The free plan takes 10 bookings a month. You'll add a service and your open times next.
      </p>

      {error && (
        <div role="alert" className="mt-[18px] p-4 rounded-[14px] bg-[var(--desk-danger-bg)] border border-[var(--desk-danger-border)] text-[13.5px] font-semibold text-[var(--desk-danger)] leading-[1.5]">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void start()}
        disabled={busy || sent.current}
        className="mt-[22px] w-full h-[54px] rounded-[14px] bg-[var(--desk-pine-600)] text-white text-[15px] font-bold cursor-pointer shadow-[0_10px_26px_rgba(15,58,83,0.26)] transition-[filter] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Set up my own booking
      </button>
    </AuthCardShell>
  );
}
