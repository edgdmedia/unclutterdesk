import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: vi.fn(), patch: vi.fn() },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
const logout = vi.fn().mockResolvedValue(undefined);
let auth: { profile: Record<string, unknown> | null; isLoading: boolean };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ ...auth, logout }) }));
const { OnboardingWizardPage } = await import('../practice/OnboardingWizardPage');

const owner = { id: '55', email: 'owner@calm.ng', type: 'therapist', role: 'OWNER', status: 'active', tenantId: '27', practiceName: 'Calm Rooms' };

function renderSetup() {
  return renderWithApp(
    <Routes>
      <Route path="/onboarding" element={<OnboardingWizardPage />} />
      <Route path="/login" element={<p>login page</p>} />
    </Routes>,
    { route: '/onboarding' },
  );
}

beforeEach(() => {
  get.mockReset();
  logout.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  get.mockResolvedValue({});
});
afterEach(cleanup);

describe('Onboarding access', () => {
  it('sends a signed-out visitor to sign in', async () => {
    auth = { profile: null, isLoading: false };
    renderSetup();
    expect(await screen.findByText('login page')).toBeTruthy();
  });

  it('tells a platform admin this is not a practice account, and lets them switch', async () => {
    auth = { profile: { id: '3', email: 'admin@unclutterdesk.com', type: 'platform_admin', status: 'active' }, isLoading: false };
    renderSetup();
    expect(await screen.findByText(/admin@unclutterdesk.com/)).toBeTruthy();
    expect(screen.getByText(/isn't a practice account/i)).toBeTruthy();
    expect(get).not.toHaveBeenCalledWith('/v1/tenant/brand');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in as the practice' }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(await screen.findByText('login page')).toBeTruthy();
  });

  it('never shows another practice its setup draft', async () => {
    auth = { profile: owner, isLoading: false };
    localStorage.setItem('unclutter_onboarding_v1:99', JSON.stringify({ stepIndex: 3, accountNumber: '0123456789' }));
    localStorage.setItem('unclutter_onboarding_v1', JSON.stringify({ stepIndex: 3, accountNumber: '0123456789' }));
    renderSetup();
    // Starts at the first step, with nothing carried over.
    expect(await screen.findByText(/STEP 01 OF/)).toBeTruthy();
    // The old shared draft is removed rather than left for the next account.
    expect(localStorage.getItem('unclutter_onboarding_v1')).toBeNull();
  });

  it("picks up the practice's own draft", async () => {
    auth = { profile: owner, isLoading: false };
    localStorage.setItem('unclutter_onboarding_v1:27', JSON.stringify({ stepIndex: 1 }));
    renderSetup();
    expect(await screen.findByText(/STEP 02 OF/)).toBeTruthy();
  });
});
