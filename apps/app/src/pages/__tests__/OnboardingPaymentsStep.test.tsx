import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
  },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: '1', type: 'therapist', role: 'OWNER', status: 'active', tenantId: '27', practiceName: 'Calm Rooms', email: 'a@calm.ng' },
    isLoading: false,
    logout: vi.fn(),
  }),
}));
const { OnboardingWizardPage } = await import('../practice/OnboardingWizardPage');

// Therapist on Starter: details, brand, availability, payout, link. Payout is index 3.
const PAYOUT_STEP = 3;

function network({ onPlan, enabled = false }: { onPlan: boolean; enabled?: boolean }) {
  get.mockImplementation(async (url: string) => {
    if (url === '/v1/consult/manual-payments/settings') return { enabled, details: null, onPlan, holdHours: 48 };
    if (url.startsWith('/v1/billing/resolve-account')) return { account_name: 'CALM ROOMS LTD' };
    if (url.startsWith('/v1/tenant/check-slug')) return { available: true };
    return {};
  });
  post.mockResolvedValue({});
  patch.mockImplementation(async (_url: string, body: { enabled: boolean }) => ({ enabled: body.enabled, details: null, onPlan, holdHours: 48 }));
}

function renderStep() {
  localStorage.setItem('unclutter_onboarding_v1:27', JSON.stringify({ stepIndex: PAYOUT_STEP }));
  return renderWithApp(<OnboardingWizardPage />, { route: '/onboarding' });
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe('Onboarding: how clients pay', () => {
  it('says Paystack processes payments and quotes the Starter fee truthfully', async () => {
    network({ onPlan: false });
    renderStep();
    expect(await screen.findByRole('heading', { name: 'How clients pay' })).toBeTruthy();
    expect(screen.getByText(/processed securely by Paystack/i)).toBeTruthy();
    expect(await screen.findByText(/5% platform fee/i)).toBeTruthy();
    expect(screen.queryByText(/0%/)).toBeNull();
    expect(screen.queryByText(/telehealth/i)).toBeNull();
    expect(screen.getByText(/bank transfer is part of the Pro and Clinic plans/i)).toBeTruthy();
    expect(screen.queryByLabelText('Let clients pay by bank transfer')).toBeNull();
  });

  it('tells Pro and Clinic practices there is no platform fee', async () => {
    network({ onPlan: true });
    renderStep();
    expect(await screen.findByText(/no platform fee on your plan/i)).toBeTruthy();
    expect(screen.queryByText(/5% platform fee/i)).toBeNull();
  });

  it('turns on bank transfer, filled from the payout account', async () => {
    network({ onPlan: true });
    renderStep();
    fireEvent.change(await screen.findByLabelText('Account number'), { target: { value: '0123456789' } });
    await waitFor(() => expect((screen.getByLabelText('Account holder name') as HTMLInputElement).value).toBe('CALM ROOMS LTD'));

    fireEvent.click(await screen.findByLabelText('Let clients pay by bank transfer'));
    expect((screen.getByLabelText('Transfer account number') as HTMLInputElement).value).toBe('0123456789');
    expect((screen.getByLabelText('Transfer account name') as HTMLInputElement).value).toBe('CALM ROOMS LTD');
    fireEvent.change(screen.getByLabelText('Note for clients (optional)'), { target: { value: 'Send your receipt to hello@calm.ng' } });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/consult/manual-payments/settings', {
      enabled: true,
      details: {
        bankName: 'Guaranty Trust Bank (GTBank)',
        accountNumber: '0123456789',
        accountName: 'CALM ROOMS LTD',
        instructions: 'Send your receipt to hello@calm.ng',
      },
    }));
    expect(post).toHaveBeenCalledWith('/v1/billing/bank-subaccount', expect.objectContaining({ accountNumber: '0123456789' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'How clients pay' })).toBeNull());
  });

  it('stays on the step and shows the reason when bank transfer cannot be saved', async () => {
    network({ onPlan: true });
    patch.mockRejectedValue(new Error('Add the bank name, account name and a 10-digit account number before turning this on.'));
    renderStep();
    fireEvent.click(await screen.findByLabelText('Let clients pay by bank transfer'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/10-digit account number before turning this on/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'How clients pay' })).toBeTruthy();
  });

  it('can be skipped without saving anything', async () => {
    network({ onPlan: true });
    renderStep();
    await screen.findByLabelText('Let clients pay by bank transfer');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'How clients pay' })).toBeNull());
    expect(post).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });
});
