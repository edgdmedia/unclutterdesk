import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const patch = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: vi.fn(), patch: (...a: unknown[]) => patch(...a) },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: '55', type: 'therapist', role: 'OWNER', status: 'active', tenantId: '27', practiceName: 'EDGD Media', email: 'a@edgd.ng' },
    isLoading: false,
    logout: vi.fn(),
  }),
}));
const { OnboardingWizardPage } = await import('../practice/OnboardingWizardPage');

const DRAFT = 'unclutter_onboarding_v1:27';
const server = { name: 'EDGD Media', slug: 'edgdmedia-3663', primaryColor: '#1E1B4B', secondaryColor: '#3B82F6', logoUrl: 'data:image/png;base64,QUJD' };

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  get.mockImplementation(async (url: string) => {
    if (url === '/v1/tenant/brand') return server;
    if (url.startsWith('/v1/tenant/check-slug')) return { available: true };
    if (url === '/v1/consult/manual-payments/settings') return { enabled: false, details: null, onPlan: false, holdHours: 48 };
    return {};
  });
  patch.mockResolvedValue({});
});
afterEach(cleanup);

function openBrandStep() {
  localStorage.setItem(DRAFT, JSON.stringify({ stepIndex: 1 }));
  renderWithApp(<OnboardingWizardPage />, { route: '/onboarding' });
}

describe('Onboarding: brand step', () => {
  it('starts from what the practice already saved', async () => {
    openBrandStep();
    await waitFor(() => expect((screen.getByLabelText(/booking link/i) as HTMLInputElement).value).toBe('edgdmedia-3663'));
    expect((screen.getByRole('img', { name: 'Practice logo' }) as HTMLImageElement).src).toBe(server.logoUrl);
  });

  it('keeps the booking link being typed, and saves it with the logo and colours', async () => {
    openBrandStep();
    const input = (await screen.findByLabelText(/booking link/i)) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('edgdmedia-3663'));
    fireEvent.change(input, { target: { value: 'edgdmedia' } });
    await new Promise((r) => setTimeout(r, 50));
    expect(input.value).toBe('edgdmedia');

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/v1/tenant/brand',
        expect.objectContaining({ slug: 'edgdmedia', primaryColor: '#1E1B4B', secondaryColor: '#3B82F6', logoUrl: server.logoUrl }),
      ),
    );
  });

  it('sends a removed logo as removed, so it does not come back', async () => {
    openBrandStep();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove logo' }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/tenant/brand', expect.objectContaining({ logoUrl: null })));
  });

  it('after a refresh, keeps unsaved edits from the draft and fills the rest from the server', async () => {
    localStorage.setItem(DRAFT, JSON.stringify({ stepIndex: 1, slug: 'my-new-link', slugTouched: true }));
    renderWithApp(<OnboardingWizardPage />, { route: '/onboarding' });
    const input = (await screen.findByLabelText(/booking link/i)) as HTMLInputElement;
    await waitFor(() => expect(screen.getByRole('img', { name: 'Practice logo' })).toBeTruthy());
    expect(input.value).toBe('my-new-link');
  });

  it("doesn't offer a custom domain during setup, even when the server could take one (SET-03)", async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/v1/tenant/brand') return { ...server, customDomainTarget: 'cname.unclutterdesk.com' };
      if (url.startsWith('/v1/tenant/check-slug')) return { available: true };
      if (url === '/v1/consult/manual-payments/settings') return { enabled: false, details: null, onPlan: false, holdHours: 48 };
      return {};
    });
    openBrandStep();
    await waitFor(() => expect((screen.getByLabelText(/booking link/i) as HTMLInputElement).value).toBe('edgdmedia-3663'));
    expect(screen.queryByRole('button', { name: /custom domain/i })).toBeNull();
    expect(screen.queryByPlaceholderText(/booking\.mypractice\.com/)).toBeNull();
  });
});

