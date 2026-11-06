import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/**
 * A client booked Consultation and meant Individual Session (plan
 * 2026-11-04-change-session-service). Staff change it from the session page,
 * see the new end time and any balance first, then settle the balance.
 */
const apiGet = vi.fn();
const apiPatch = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    post: (...a: unknown[]) => apiPost(...a),
  },
  getBookingUrl: () => 'https://dr-smith.unclutterdesk.com',
  TENANT_SLUG: 'dr-smith',
}));

const auth = { profile: { id: '9', role: 'ADMIN', tenantSlug: 'dr-smith' } };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth, useOptionalAuth: () => auth }));

const { SessionDetailPage } = await import('../practice/SessionDetailPage');

const start = new Date(Date.now() + 2 * 86_400_000);
start.setUTCMinutes(0, 0, 0);
const DETAIL = {
  id: '900', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
  status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: '1000000', holdExpiresAt: null, bookedBy: null,
  client: { id: '40', name: 'Ada Ola' }, serviceId: '2', serviceTitle: 'Consultation', durationMinutes: 30,
  provider: { id: '6', name: 'Segun Ade' }, channel: 'VIDEO',
  clientEmail: 'ada@example.com', clientPhone: null, videoRoomLink: '/session/900',
  note: null, internalSummary: null, clientRecap: null, clientRecapSentAt: null,
  format: 'ONLINE', location: null, balanceKobo: null, balanceStatus: null,
  can: { edit: true, summary: false, markPaid: true },
};
const SERVICES = [
  { id: '2', title: 'Consultation', durationMinutes: 30, priceKobo: '1000000', formats: [{ format: 'ONLINE', priceKobo: '1000000', isActive: true }] },
  { id: '3', title: 'Individual Session', durationMinutes: 60, priceKobo: '3500000', formats: [{ format: 'ONLINE', priceKobo: '3500000', isActive: true }] },
  { id: '4', title: 'Couples (in person)', durationMinutes: 90, priceKobo: '5000000', formats: [{ format: 'IN_PERSON', priceKobo: '5000000', isActive: true }] },
];

beforeEach(() => { apiGet.mockReset(); apiPatch.mockReset(); apiPost.mockReset(); });
afterEach(cleanup);

function renderPage(detail: Record<string, unknown> = DETAIL) {
  let current = detail;
  apiGet.mockImplementation((p: string) =>
    p === '/v1/consult/practice/sessions/900'
      ? Promise.resolve(current)
      : p === '/v1/consult/public/services'
        ? Promise.resolve(SERVICES)
        : Promise.resolve([]),
  );
  const view = renderWithApp(
    <Routes><Route path="/dashboard/sessions/:id" element={<SessionDetailPage />} /></Routes>,
    { route: '/dashboard/sessions/900' },
  );
  return { ...view, setDetail: (d: Record<string, unknown>) => { current = d; } };
}

describe('changing the service of a booked session', () => {
  it('lists only other services offered in the session format, and previews the time and balance', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Service' }));
    const option = await screen.findByRole('radio', { name: /Individual Session, 60 minutes, ₦35,000/ });
    expect(screen.queryByRole('radio', { name: /^Consultation/ })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Couples/ })).toBeNull();

    fireEvent.click(option);
    expect(screen.getByText(/instead of .*if Segun Ade is free then/)).toBeTruthy();
    expect(screen.getByText(/Balance ₦25,000/)).toBeTruthy();
  });

  it('saves the change and shows the balance to settle', async () => {
    const { setDetail } = renderPage();
    apiPatch.mockResolvedValue({ serviceTitle: 'Individual Session', endsAt: DETAIL.endsAt, balanceKobo: '2500000', overpaidKobo: '0' });
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Service' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Individual Session/ }));
    setDetail({ ...DETAIL, serviceId: '3', serviceTitle: 'Individual Session', balanceKobo: '2500000', balanceStatus: 'DUE' });
    fireEvent.click(screen.getAllByRole('button', { name: /Change service/ }).at(-1)!);

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/service', { serviceId: '3' }));
    expect(await screen.findByText(/is still owed: the session was changed/)).toBeTruthy();
  });

  it('an unpaid booking previews the new amount to pay, with no balance', async () => {
    renderPage({ ...DETAIL, status: 'PENDING_PAYMENT' });
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Service' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Individual Session/ }));
    expect(screen.getByText(/the amount to pay becomes/)).toBeTruthy();
    expect(screen.queryByText(/Balance/)).toBeNull();
  });

  it('the desk records a balance as paid at the practice, or waives it', async () => {
    renderPage({ ...DETAIL, balanceKobo: '2500000', balanceStatus: 'DUE' });
    apiPost.mockResolvedValue({ balanceStatus: 'PAID' });
    fireEvent.click(await screen.findByRole('button', { name: 'Paid at the practice' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/balance', { action: 'PAID' }));
    fireEvent.click(screen.getByRole('button', { name: 'Waive' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/balance', { action: 'WAIVED' }));
  });

  it('a cancelled session offers no change', async () => {
    renderPage({ ...DETAIL, status: 'CANCELLED' });
    await screen.findByRole('heading', { name: 'Ada Ola' });
    expect(screen.queryByRole('button', { name: /Edit session/ })).toBeNull();
  });
});
