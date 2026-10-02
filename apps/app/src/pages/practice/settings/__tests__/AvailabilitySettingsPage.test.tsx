import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

const get = vi.fn();
const patch = vi.fn();
vi.mock('../../../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a) } };
});
const { AvailabilitySettingsPage } = await import('../AvailabilitySettingsPage');

const PAYLOAD = {
  cancellationHours: 24,
  sessionLengthMinutes: 50,
  gapMinutes: 10,
  locations: [
    { id: '4', name: 'Lekki clinic', city: 'Lagos' },
    { id: '6', name: 'Ikoyi rooms', city: 'Lagos' },
  ],
  weeklyTimes: [
    { weekday: 0, start: '09:00', formats: ['ONLINE'], locationId: null },
    { weekday: 0, start: '10:00', formats: ['ONLINE', 'IN_PERSON'], locationId: '4' },
  ],
  slots: [
    { id: '30', startsAt: '2026-10-08T08:00:00.000Z', endsAt: '2026-10-08T08:50:00.000Z', isActive: true, formats: ['ONLINE'], location: null, customised: false, booked: false },
    { id: '31', startsAt: '2026-10-08T09:00:00.000Z', endsAt: '2026-10-08T09:50:00.000Z', isActive: true, formats: ['IN_PERSON'], location: { id: '4', name: 'Lekki clinic' }, customised: false, booked: true },
  ],
};

beforeEach(() => {
  get.mockReset(); patch.mockReset();
  get.mockResolvedValue(PAYLOAD);
  patch.mockResolvedValue(PAYLOAD);
});
afterEach(cleanup);

describe('the availability page', () => {
  it('loads the stored weekly times and shows each time with its format', async () => {
    renderWithApp(<AvailabilitySettingsPage />);
    expect(await screen.findByText('Monday')).toBeTruthy();
    expect(screen.getAllByText('09:00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10:00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Either · Lekki clinic').length).toBeGreaterThan(0);
  });

  it('choosing a format on a tile and saving sends weeklyTimes', async () => {
    renderWithApp(<AvailabilitySettingsPage />);
    const tile = (await screen.findAllByRole('button', { name: /Format Online/ }))[0];
    fireEvent.click(tile);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Either' }));
    fireEvent.click(screen.getByRole('button', { name: /save availability/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/consult/therapist/availability', expect.objectContaining({
      weeklyTimes: expect.arrayContaining([
        { weekday: 0, start: '09:00', formats: ['ONLINE', 'IN_PERSON'], locationId: '4' },
      ]),
    })));
  });

  it('"Set all Monday times to" changes every Monday tile', async () => {
    renderWithApp(<AvailabilitySettingsPage />);
    const setAll = await screen.findByLabelText(/set all monday times to/i);
    fireEvent.change(setAll, { target: { value: 'ONLINE' } });
    expect(screen.getAllByText('Online').length).toBeGreaterThanOrEqual(2);
  });

  it('the location chooser lists only the practice locations', async () => {
    renderWithApp(<AvailabilitySettingsPage />);
    const tile = (await screen.findAllByRole('button', { name: /Format Online/ }))[0];
    fireEvent.click(tile);
    const select = await screen.findByLabelText(/location/i);
    const options = (select as HTMLSelectElement).options;
    const names = Array.from(options).map((o) => o.textContent);
    expect(names).toEqual(['None (online only)', 'Lekki clinic', 'Ikoyi rooms']);
  });

  it('an upcoming time changed to In person patches the slot and shows This date only', async () => {
    renderWithApp(<AvailabilitySettingsPage />);
    await screen.findByText('Monday');
    // The first upcoming tile (Thu 8 Oct 09:00Z slot id 30).
    const slotTile = screen.getAllByRole('button', { name: /Format Online/ })[1];
    fireEvent.click(slotTile);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'In person' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/consult/therapist/slots/30', { formats: ['IN_PERSON'], locationId: '4' }));
  });

  it('a booked upcoming time cannot be changed', async () => {
    renderWithApp(<AvailabilitySettingsPage />);
    await screen.findByText('Monday');
    const booked = screen.getByRole('button', { name: /Booked time In person · Lekki clinic/ });
    expect(booked.hasAttribute('disabled')).toBe(true);
  });

  it('the server 400 text shows in the error banner', async () => {
    patch.mockRejectedValueOnce(new Error('Mon 10:00: Ada only works online. Turn on in-person for Ada first.'));
    renderWithApp(<AvailabilitySettingsPage />);
    await screen.findByText('Monday');
    fireEvent.click(screen.getByRole('button', { name: /save availability/i }));
    expect((await screen.findAllByText(/only works online/))[0].textContent).toMatch(/Mon 10:00/);
  });
});
