import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  apiRequest: vi.fn(),
  API_BASE: 'https://api.x',
  getSubdomainTenantSlug: () => 'smith',
}));
const logout = vi.fn().mockResolvedValue(undefined);
let me: Record<string, unknown> | null;
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ profile: me, isAuthenticated: !!me, logout, login: vi.fn() }),
}));
const { BookingWizardPage } = await import('../BookingWizardPage');

const practice = { id: '27', name: 'Smith Therapy & Wellness', logoUrl: null, primaryColor: '#24614F', secondaryColor: '#8A5A3C', publicEmail: 'hi@smith.ng', publicPhone: '080', address: null, city: 'Lagos', cancellationHours: 24 };
const twoServices = [
  { id: '1', title: 'Initial consultation', durationMinutes: 30, priceKobo: '1500000' },
  { id: '2', title: 'Individual therapy', durationMinutes: 50, priceKobo: '3500000' },
];
// Thursday 1 Oct 2026 is "today"; the slot is Tue 6 Oct, 11:30 WAT.
const slot = { id: '5', serviceId: null, therapistName: 'Sarah Smith', therapistTitle: 'PhD, LCSW', startsAt: '2026-10-06T10:30:00Z', endsAt: '2026-10-06T11:20:00Z', channel: 'VIDEO' };
const booked = { bookingId: '900', icalToken: 'tok', startsAt: slot.startsAt, endsAt: slot.endsAt, therapistName: 'Sarah Smith', serviceTitle: 'Individual therapy', status: 'PENDING_PAYMENT', paymentUrl: 'https://checkout.paystack.com/x', accessCode: 'ac_123', reference: 'booking-900-1', manualPayment: null };

function network({ services = twoServices, slots = [slot], bankTransfer = true, slotsAfterReload }: { services?: unknown[]; slots?: unknown[]; bankTransfer?: boolean; slotsAfterReload?: unknown[] } = {}) {
  let availabilityCalls = 0;
  get.mockImplementation(async (url: string) => {
    if (url === '/v1/tenant/public/info/smith') return practice;
    if (url === '/v1/consult/public/services') return services;
    if (url === '/v1/consult/public/availability') {
      availabilityCalls += 1;
      return availabilityCalls > 1 && slotsAfterReload ? slotsAfterReload : slots;
    }
    if (url === '/v1/intake/public/reviews') return { averageRating: 4.9, count: 32 };
    if (url === '/v1/consult/public/payment-options') return { online: true, bankTransfer };
    throw new Error(`unexpected ${url}`);
  });
}

// Paystack's script is the network boundary for payments.
function paystack(outcome: 'onSuccess' | 'onCancel') {
  const resume = vi.fn((_code: string, cb: Record<string, () => void>) => cb[outcome]());
  (window as any).PaystackPop = vi.fn(() => ({ resumeTransaction: resume }));
  return resume;
}

const cta = (name: RegExp | string) => screen.getByRole('button', { name });

async function reachPay() {
  fireEvent.click(await screen.findByRole('button', { name: /Individual therapy/ }));
  fireEvent.click(cta('Continue'));
  fireEvent.click(await screen.findByRole('button', { name: /Tue, 6 Oct/ }));
  fireEvent.click(screen.getByRole('button', { name: /11:30 AM/ }));
  fireEvent.click(cta('Continue'));
  await screen.findByRole('heading', { name: 'Your details' });
  fireEvent.click(cta('Continue to payment'));
  await screen.findByRole('heading', { name: 'Review and pay' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T08:00:00Z'));
  get.mockReset();
  post.mockReset();
  logout.mockClear();
  me = { id: '40', type: 'user', role: 'CLIENT', firstName: 'Ada', lastName: 'Okafor', email: 'ada@x.com', phone: '0801' };
  delete (window as any).PaystackPop;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BookingWizardPage', () => {
  it('books and pays online, end to end', async () => {
    network();
    const resume = paystack('onSuccess');
    post.mockImplementation(async (url: string) => {
      if (url === '/v1/consult/public/bookings') return booked;
      if (url === '/v1/consult/public/bookings/900/confirm-payment') return { status: 'CONFIRMED' };
      throw new Error(`unexpected ${url}`);
    });
    renderWithApp(<BookingWizardPage />, { route: '/book' });
    expect(await screen.findByText('Smith Therapy & Wellness')).toBeTruthy();
    await reachPay();
    fireEvent.click(cta('Pay ₦35,000'));
    expect(await screen.findByRole('heading', { name: "You're booked" })).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/v1/consult/public/bookings', expect.objectContaining({ serviceId: '2', availabilityId: '5', phone: '0801' }));
    expect(resume).toHaveBeenCalledWith('ac_123', expect.any(Object));
    expect(post).toHaveBeenCalledWith('/v1/consult/public/bookings/900/confirm-payment', {});
  });

  it('opens on the times when the practice has one service, with no way to change it', async () => {
    network({ services: [twoServices[1]] });
    renderWithApp(<BookingWizardPage />, { route: '/book' });
    expect(await screen.findByRole('heading', { name: 'Pick a time' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
  });

  it('sends the client back to the times when their time goes before Continue', async () => {
    network({ slotsAfterReload: [] });
    renderWithApp(<BookingWizardPage />, { route: '/book' });
    fireEvent.click(await screen.findByRole('button', { name: /Individual therapy/ }));
    fireEvent.click(cta('Continue'));
    fireEvent.click(await screen.findByRole('button', { name: /Tue, 6 Oct/ }));
    fireEvent.click(screen.getByRole('button', { name: /11:30 AM/ }));
    fireEvent.click(cta('Continue'));
    expect(await screen.findByText('That time was just booked')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeTruthy();
  });

  it('sends the client back to the times when the booking finds the time gone', async () => {
    network();
    post.mockRejectedValue(new Error('The selected time slot is no longer available'));
    renderWithApp(<BookingWizardPage />, { route: '/book' });
    await reachPay();
    fireEvent.click(cta('Pay ₦35,000'));
    expect(await screen.findByText('That time was just booked')).toBeTruthy();
  });

  it('keeps the booking when the pop-up is closed, and retries it rather than booking twice', async () => {
    network();
    paystack('onCancel');
    post.mockImplementation(async (url: string) => {
      if (url === '/v1/consult/public/bookings') return booked;
      if (url === '/v1/consult/public/bookings/900/pay') return { paymentUrl: 'u', accessCode: 'ac_456', reference: 'booking-900-2' };
      throw new Error(`unexpected ${url}`);
    });
    renderWithApp(<BookingWizardPage />, { route: '/book' });
    await reachPay();
    fireEvent.click(cta('Pay ₦35,000'));
    expect(await screen.findByText("Your payment didn't go through")).toBeTruthy();
    const retry = cta('Try again · ₦35,000');
    paystack('onCancel');
    fireEvent.click(retry);
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/consult/public/bookings/900/pay', { email: 'ada@x.com' }));
    expect(post.mock.calls.filter(([url]) => url === '/v1/consult/public/bookings')).toHaveLength(1);
  });

  it('holds the time for a bank transfer and shows the reference', async () => {
    network();
    post.mockResolvedValue({ ...booked, status: 'PENDING_PAYMENT', paymentUrl: null, accessCode: null, manualPayment: { bankName: 'GTBank', accountName: 'Smith Therapy', accountNumber: '0123456789', reference: 'UD-900', amountKobo: '3500000', holdExpiresAt: '2026-10-03T08:00:00Z' } });
    renderWithApp(<BookingWizardPage />, { route: '/book' });
    await reachPay();
    fireEvent.click(screen.getByRole('radio', { name: /Bank transfer/ }));
    fireEvent.click(cta('Hold my time'));
    expect(await screen.findByRole('heading', { name: 'Your time is held' })).toBeTruthy();
    expect(screen.getByText('UD-900')).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/v1/consult/public/bookings', expect.objectContaining({ paymentMethod: 'MANUAL' }));
  });

  it('asks a signed-out client to sign in before going on', async () => {
    me = null;
    network();
    renderWithApp(<BookingWizardPage />, { route: '/book' });
    fireEvent.click(await screen.findByRole('button', { name: /Individual therapy/ }));
    fireEvent.click(cta('Continue'));
    fireEvent.click(await screen.findByRole('button', { name: /Tue, 6 Oct/ }));
    fireEvent.click(screen.getByRole('button', { name: /11:30 AM/ }));
    fireEvent.click(cta('Continue'));
    await screen.findByRole('heading', { name: 'Your details' });
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    // The account form's own button is the only way on: no second, disabled Continue.
    expect(screen.queryByRole('button', { name: 'Continue to payment' })).toBeNull();
  });

  it('opens at the start when the address asks for a later step it cannot show yet', async () => {
    network();
    renderWithApp(<BookingWizardPage />, { route: '/book?step=pay' });
    expect(await screen.findByRole('heading', { name: 'Choose a session' })).toBeTruthy();
  });

  it('shows the practice brand and rating in the header', async () => {
    network();
    renderWithApp(<BookingWizardPage />, { route: '/book' });
    const header = (await screen.findByText('Smith Therapy & Wellness')).closest('header')!;
    expect(within(header).getByText('ST')).toBeTruthy();
    expect(within(header).getByRole('link', { name: /4.9 · 32 reviews/ })).toBeTruthy();
  });
});
