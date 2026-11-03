import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/* §6.9: choosing how clients book from the profile. Only the network is stubbed. */
let booking: any;
const get = vi.fn(async (..._a: unknown[]) => booking);
const put = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) } };
});
let auth: any = null;
vi.mock('../../context/AuthContext', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../context/AuthContext')>();
  return { ...real, useOptionalAuth: () => auth };
});
const { BookingChoice } = await import('../practice/profile/BookingChoice');

const info = (over = {}) => ({ mode: 'NONE', externalBookingUrl: null, deskReady: false, deskMissing: ['service', 'availability'], deskBookingUrl: null, ...over });

afterEach(() => {
  cleanup();
  put.mockReset();
});

describe('how clients book', () => {
  it('lists booking through Therapysts first, as recommended, then own link and contact only', async () => {
    booking = info();
    auth = { profile: { onboardingIntent: 'PRACTICE' } };
    renderWithApp(<BookingChoice />);
    const radios = await screen.findAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(['DESK', 'EXTERNAL', 'NONE']);
    expect(screen.getByText('Recommended')).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Contact only/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('offers the set-up instead of saving while the practice cannot take bookings', async () => {
    booking = info({ deskMissing: ['availability'] });
    auth = { profile: { onboardingIntent: 'PRACTICE' } };
    renderWithApp(
      <Routes>
        <Route path="/" element={<BookingChoice />} />
        <Route path="/dashboard/settings/availability" element={<p>Open times</p>} />
      </Routes>,
    );
    fireEvent.click(await screen.findByRole('radio', { name: /Clients book through Therapysts/ }));
    expect(screen.getByText('To take bookings here, add the times you are open.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save booking choice' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Set up booking · takes about 5 minutes' }));
    expect(await screen.findByText('Open times')).toBeTruthy();
  });

  it('saves an own booking link', async () => {
    booking = info();
    auth = { profile: { onboardingIntent: 'PRACTICE' } };
    put.mockResolvedValue(info({ mode: 'EXTERNAL', externalBookingUrl: 'https://cal.example/f' }));
    renderWithApp(<BookingChoice />);
    fireEvent.click(await screen.findByRole('radio', { name: /Use my own booking link/ }));
    fireEvent.change(screen.getByLabelText(/Your booking link/), { target: { value: 'https://cal.example/f' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save booking choice' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/v1/practitioner-profile/me/booking', { mode: 'EXTERNAL', externalBookingUrl: 'https://cal.example/f' }));
  });

  it('saves booking through Therapysts once ready, and shows where the Book button goes', async () => {
    booking = info({ deskReady: true, deskMissing: [] });
    auth = { profile: { onboardingIntent: 'PRACTICE' } };
    put.mockResolvedValue(info({ mode: 'DESK', deskReady: true, deskMissing: [], deskBookingUrl: 'https://folake.example.test/book' }));
    renderWithApp(<BookingChoice />);
    fireEvent.click(await screen.findByRole('radio', { name: /Clients book through Therapysts/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save booking choice' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/v1/practitioner-profile/me/booking', { mode: 'DESK' }));
    expect(await screen.findByRole('link', { name: 'https://folake.example.test/book' })).toBeTruthy();
  });
});
