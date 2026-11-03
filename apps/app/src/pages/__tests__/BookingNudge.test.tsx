import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/* §6.8: the one-time "switch on booking" offer after a profile-first therapist publishes. */
const post = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, post: (...a: unknown[]) => post(...a) } };
});
let auth: any = null;
vi.mock('../../context/AuthContext', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../context/AuthContext')>();
  return { ...real, useOptionalAuth: () => auth };
});
const { BookingNudge } = await import('../practice/profile/BookingNudge');

afterEach(() => {
  cleanup();
  post.mockReset();
  localStorage.clear();
});

const profileFirst = (over = {}) => ({ profile: { tenantId: '3', onboardingIntent: 'PROFILE', ...over }, refreshProfile: vi.fn().mockResolvedValue(undefined) });

describe('the booking offer', () => {
  it('shows only for a published, profile-first practice', () => {
    auth = profileFirst();
    const { rerender } = renderWithApp(<BookingNudge published={false} />);
    expect(screen.queryByText('Want clients to book you here?')).toBeNull();
    rerender(<BookingNudge published />);
    expect(screen.getByText('Want clients to book you here?')).toBeTruthy();
    auth = profileFirst({ onboardingIntent: 'PRACTICE' });
    rerender(<BookingNudge published />);
    expect(screen.queryByText('Want clients to book you here?')).toBeNull();
  });

  it('switches the practice to the full view and opens the set-up steps', async () => {
    auth = profileFirst();
    post.mockResolvedValue({ onboardingIntent: 'PRACTICE' });
    renderWithApp(
      <Routes>
        <Route path="/" element={<BookingNudge published />} />
        <Route path="/onboarding" element={<p>Set-up steps</p>} />
      </Routes>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set up booking' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/tenant/switch-on-booking', {}));
    expect(auth.refreshProfile).toHaveBeenCalled();
    expect(await screen.findByText('Set-up steps')).toBeTruthy();
  });

  it('stays hidden after "Not now" on this device', () => {
    auth = profileFirst();
    renderWithApp(<BookingNudge published />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('Want clients to book you here?')).toBeNull();
    cleanup();
    renderWithApp(<BookingNudge published />);
    expect(screen.queryByText('Want clients to book you here?')).toBeNull();
  });
});
