import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@unclutterdesk/ui';
import { useOptionalAuth } from '../../../context/AuthContext';
import { api } from '../../../utils/apiClient';

/**
 * "Set up booking" from the profile (§6.8, §6.9). A profile-first account is
 * switched to the full practice view and taken through the set-up steps;
 * an account already in practice mode goes straight to the first missing
 * piece (a service, then open times).
 */
export function useStartBookingSetup() {
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function start(missing: ('service' | 'availability')[] = ['service', 'availability']) {
    if (auth?.profile?.onboardingIntent !== 'PROFILE') {
      navigate(missing[0] === 'availability' ? '/dashboard/settings/availability' : '/dashboard/settings/services');
      return;
    }
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

  return { start, busy };
}
