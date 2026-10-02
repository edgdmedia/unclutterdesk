import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a) },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: '55', type: 'therapist', role: 'OWNER', status: 'active', tenantId: '27', practiceName: 'Smith Therapy', email: 'a@smith.ng' },
    isLoading: false,
    logout: vi.fn(),
  }),
}));
const { OnboardingWizardPage } = await import('../practice/OnboardingWizardPage');

const DRAFT = 'unclutter_onboarding_v1:27';

function mockServer(draft: Record<string, unknown> = {}) {
  localStorage.setItem(DRAFT, JSON.stringify({ stepIndex: 2, ...draft }));
  get.mockImplementation(async (url: string) => {
    if (url === '/v1/tenant/brand') return { name: 'Smith Therapy', slug: 'smith-therapy', primaryColor: '#0F3A53', secondaryColor: '#E3B341' };
    if (url === '/v1/tenant/locations') return [];
    if (url === '/v1/consult/services') return [];
    if (url === '/v1/consult/manual-payments/settings') return { enabled: false, details: null, onPlan: false, holdHours: 48 };
    return {};
  });
  post.mockImplementation(async (url: string) => {
    if (url === '/v1/tenant/locations') return { id: '7', name: 'Smith Therapy', address: '12 Admiralty Way', city: 'Lagos' };
    return { id: '20' };
  });
  patch.mockResolvedValue({});
}

function openServicesStep() {
  renderWithApp(<OnboardingWizardPage />, { route: '/onboarding' });
}

beforeEach(() => { get.mockReset(); post.mockReset(); patch.mockReset(); localStorage.clear(); sessionStorage.clear(); });
afterEach(cleanup);

describe('setup: how do you see clients', () => {
  it('says online sessions run in our own video room (ONB-08)', async () => {
    mockServer();
    openServicesStep();
    expect(await screen.findByText(/Online sessions run in Unclutter Desk's own video room/)).toBeTruthy();
  });

  it('Both saves a location, both formats, the therapist flags and a split week', async () => {
    mockServer();
    openServicesStep();
    fireEvent.click(await screen.findByRole('radio', { name: /both/i }));
    fireEvent.change(screen.getByPlaceholderText(/12 Admiralty Way/i), { target: { value: '12 Admiralty Way' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. Lagos/i), { target: { value: 'Lagos' } });
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/tenant/locations', expect.objectContaining({ name: 'Smith Therapy', address: '12 Admiralty Way', city: 'Lagos' })));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/v1/consult/therapist/profile', expect.objectContaining({ offersOnline: true, offersInPerson: true, locationIds: ['7'] })),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/consult/services', expect.objectContaining({
        formats: [
          { format: 'ONLINE', priceKobo: 3500000, isActive: true },
          { format: 'IN_PERSON', priceKobo: 3500000, isActive: true },
        ],
      })),
    );
    const weekly = patch.mock.calls.find((c: any[]) => c[0] === '/v1/consult/therapist/availability')?.[1]?.weeklyTimes;
    expect(weekly).toBeTruthy();
    const monday = weekly.filter((t: any) => t.weekday === 0);
    expect(monday.find((t: any) => t.start === '09:00')?.formats).toEqual(['IN_PERSON']);
    expect(monday.find((t: any) => t.start === '14:00')?.formats).toEqual(['ONLINE']);
  });

  it('Online sends no location and an all-online week', async () => {
    mockServer();
    openServicesStep();
    fireEvent.click(screen.getByRole('radio', { name: /online/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/consult/therapist/availability', expect.objectContaining({ weeklyTimes: expect.any(Array) })));
    expect(post).not.toHaveBeenCalledWith('/v1/tenant/locations', expect.anything());
    const weekly = patch.mock.calls.find((c: any[]) => c[0] === '/v1/consult/therapist/availability')?.[1]?.weeklyTimes;
    expect(weekly.every((t: any) => t.formats.join() === 'ONLINE')).toBe(true);
  });

  it('an old draft address pre-fills the inline location', async () => {
    mockServer({ city: 'Abuja', address: '9 Wuse Lane' });
    openServicesStep();
    fireEvent.click(await screen.findByRole('radio', { name: /both/i }));
    await waitFor(() => expect((screen.getByPlaceholderText(/12 Admiralty Way/i) as HTMLInputElement).value).toBe('9 Wuse Lane'));
    expect((screen.getByPlaceholderText(/e.g. Lagos/i) as HTMLInputElement).value).toBe('Abuja');
  });

  it('a missing street address blocks Continue with the exact words', async () => {
    mockServer();
    openServicesStep();
    fireEvent.click(await screen.findByRole('radio', { name: /both/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue|next/i }));
    expect(await screen.findByText('Add the street address clients will come to.')).toBeTruthy();
    expect(post).not.toHaveBeenCalledWith('/v1/tenant/locations', expect.anything());
  });
});
