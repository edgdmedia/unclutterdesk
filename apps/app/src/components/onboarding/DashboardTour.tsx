import { useEffect, useState } from 'react';
import { Tour, type TourStep } from '@unclutterdesk/ui';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../context/AuthContext';

/** The dashboard tour, in order. Anchors are found by their data-tour id. */
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  { anchor: 'booking-link', title: 'Your booking link', body: 'Share it with clients, or copy it here. This is where they book and pay.' },
  { anchor: 'nav-sessions', title: 'Sessions', body: 'Every booking lands here. Open one to start the video call, take notes or mark it paid.' },
  { anchor: 'nav-clients', title: 'Clients', body: 'Each client’s history, forms and notes.' },
  { anchor: 'nav-availability', title: 'Availability', body: 'Set your working hours. Clients can only book times you’ve opened.' },
  { anchor: 'nav-forms', title: 'Forms', body: 'Your intake and confidentiality forms. Edit the wording to suit your practice.' },
  { anchor: 'nav-payouts', title: 'Payouts', body: 'Where client payments go: Paystack, bank transfer, or both.' },
  { anchor: 'account-menu', title: 'Your account', body: 'Your profile and settings. You can take this tour again from here.' },
];

/**
 * ONB-06: the first-time walkthrough of the dashboard, once per person on any
 * device, and replayable from the account menu.
 */
export function DashboardTour() {
  const { profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);

  const tourCompletedAt = profile?.tourCompletedAt;
  const isPractice = Boolean(profile?.tenantId);

  useEffect(() => {
    if (isPractice && tourCompletedAt == null) setOpen(true);
  }, [isPractice, tourCompletedAt]);

  useEffect(() => {
    const onStart = () => setOpen(true);
    window.addEventListener('unclutter:tour-start', onStart);
    return () => window.removeEventListener('unclutter:tour-start', onStart);
  }, []);

  function done() {
    setOpen(false);
    // Skipping counts as having seen it: the tour can be replayed from the
    // account menu, and the server keeps the very first date either way.
    void api.post('/v1/auth/me/tour-complete', {}).then(() => refreshProfile());
  }

  return <Tour steps={DASHBOARD_TOUR_STEPS} open={open} onDone={done} />;
}
