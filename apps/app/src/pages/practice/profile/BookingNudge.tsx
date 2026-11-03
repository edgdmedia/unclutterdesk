import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, useToast } from '@unclutterdesk/ui';
import { useOptionalAuth } from '../../../context/AuthContext';
import { api } from '../../../utils/apiClient';

const dismissKey = (tenantId: string) => `booking-nudge-dismissed:${tenantId}`;

function readDismissed(tenantId: string | undefined): boolean {
  if (!tenantId) return false;
  try {
    return localStorage.getItem(dismissKey(tenantId)) === '1';
  } catch {
    return false;
  }
}

/**
 * §6.8: once a profile-first therapist has published, offer booking once,
 * without pushing it. "Set up booking" switches the practice to the full
 * dashboard and opens the set-up steps; "Not now" hides the card on this device.
 */
export function BookingNudge({ published }: { published: boolean }) {
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const tenantId = auth?.profile?.tenantId ?? undefined;
  const [dismissed, setDismissed] = useState(() => readDismissed(tenantId));
  const [busy, setBusy] = useState(false);

  if (!published || dismissed || auth?.profile?.onboardingIntent !== 'PROFILE') return null;

  async function switchOn() {
    setBusy(true);
    try {
      await api.post('/v1/tenant/switch-on-booking', {});
      await auth?.refreshProfile();
      navigate('/onboarding');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not switch on booking');
      setBusy(false);
    }
  }

  function notNow() {
    try {
      if (tenantId) localStorage.setItem(dismissKey(tenantId), '1');
    } catch {
      // Storage blocked: the card simply comes back next time.
    }
    setDismissed(true);
  }

  return (
    <Card padding="lg" aria-labelledby="booking-nudge-title">
      <h2 id="booking-nudge-title" className="text-[16px] font-bold tracking-[-0.02em] text-[#0F172A]">Want clients to book you here?</h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-[#475569]">
        Switch on booking: intake forms, reminders and payments are already set up. Clients pick a time from your profile and pay in naira.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void switchOn()} disabled={busy}>{busy ? 'Switching on…' : 'Set up booking'}</Button>
        <Button variant="ghost" onClick={notNow} disabled={busy}>Not now</Button>
      </div>
    </Card>
  );
}
