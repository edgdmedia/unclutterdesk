import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return {
    ...real,
    api: {
      get: (...a: unknown[]) => get(...a),
      post: (...a: unknown[]) => post(...a),
      patch: (...a: unknown[]) => patch(...a),
      delete: (...a: unknown[]) => del(...a),
    },
  };
});
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { id: '55', type: 'therapist', role: 'OWNER', tenantId: '27', tenantSlug: 'p', plan: 'PRO' }, refreshProfile: vi.fn() }),
}));
const { LocationsSettingsPage } = await import('../practice/settings/LocationsSettingsPage');

const LOCATIONS = [
  { id: '5', name: 'Lekki clinic', address: '12 Admiralty Way', city: 'Lagos', directions: 'Gate 2', isActive: true, mapsUrl: 'https://maps.example/5', upcomingInPerson: 2 },
  { id: '6', name: 'Old office', address: '1 Marina', city: 'Lagos', directions: null, isActive: false, mapsUrl: 'https://maps.example/6', upcomingInPerson: 0 },
];

beforeEach(() => {
  get.mockReset(); post.mockReset(); patch.mockReset(); del.mockReset();
  get.mockResolvedValue(LOCATIONS);
  post.mockResolvedValue(LOCATIONS[0]);
  patch.mockResolvedValue(LOCATIONS[0]);
  del.mockResolvedValue({ deactivated: true, changedTimes: 1 });
});
afterEach(cleanup);

describe('the locations page', () => {
  it('lists places with address, city and status', async () => {
    renderWithApp(<LocationsSettingsPage />);
    expect(await screen.findByText('Lekki clinic')).toBeTruthy();
    expect(screen.getByText(/12 Admiralty Way/)).toBeTruthy();
    expect(screen.getByText(/Inactive/i)).toBeTruthy();
  });

  it('adds a location through the form', async () => {
    renderWithApp(<LocationsSettingsPage />);
    await screen.findByText('Lekki clinic');
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ikoyi rooms' } });
    fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: '4 Awolero' } });
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Lagos' } });
    fireEvent.click(screen.getByRole('button', { name: /add location/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/tenant/locations', expect.objectContaining({ name: 'Ikoyi rooms' })));
  });

  it('deactivates with a confirm and shows the server refusal text as is', async () => {
    renderWithApp(<LocationsSettingsPage />);
    await screen.findByText('Lekki clinic');
    del.mockRejectedValueOnce(new Error('3 upcoming in-person sessions use Lekki clinic: Ada (9 Oct); ….'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /deactivate Lekki clinic/i }));
    expect(await screen.findByText(/3 upcoming in-person sessions/)).toBeTruthy();
    confirmSpy.mockRestore();
  });

  it('edits inline and saves', async () => {
    renderWithApp(<LocationsSettingsPage />);
    await screen.findByText('Lekki clinic');
    fireEvent.click(screen.getByRole('button', { name: /edit Lekki clinic/i }));
    const name = await screen.findByDisplayValue('Lekki clinic');
    fireEvent.change(name, { target: { value: 'Lekki Clinic & Suite' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/tenant/locations/5', expect.objectContaining({ name: 'Lekki Clinic & Suite' })));
  });

  it('shows the empty state', async () => {
    get.mockResolvedValue([]);
    renderWithApp(<LocationsSettingsPage />);
    expect(await screen.findByText(/Add the places you see clients in person/i)).toBeTruthy();
  });
});
