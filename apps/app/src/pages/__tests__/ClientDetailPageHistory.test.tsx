import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const apiGet = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn() } }));

const { ClientDetailPage } = await import('../practice/ClientDetailPage');

const CLIENT = {
  id: '40', name: 'Ada Ola', email: 'ada@example.com', care: 'Individual Therapy', sessions: '2',
  next: 'None scheduled', status: 'Active', initials: 'AO', phone: '0801', since: 'Sept 2026',
  emergency: '', notes: [], intake: [],
};
const SESSIONS = [
  { id: '900', startsAt: '2026-08-01T09:00:00.000Z', endsAt: '2026-08-01T09:50:00.000Z', status: 'COMPLETED', paymentMethod: 'PAYSTACK', amountKobo: '3500000', holdExpiresAt: null, bookedBy: null, client: { id: '40', name: 'Ada Ola' }, serviceTitle: 'Individual Therapy', provider: { id: '6', name: 'Segun' }, channel: 'VIDEO' },
];
const PAYMENTS = {
  payments: [{ bookingId: '900', serviceTitle: 'Individual Therapy', sessionAt: '2026-08-01T09:00:00.000Z', amountKobo: '3500000', discountCode: null, status: 'COMPLETED', paidAt: '2026-07-20T10:00:00.000Z', reference: 'booking-900-1', bookedAt: '2026-07-19T10:00:00.000Z' }],
  totalPaidKobo: '3500000',
  outstandingKobo: '0',
};

beforeEach(() => apiGet.mockReset());
afterEach(cleanup);

function renderPage(canViewPayments = true) {
  apiGet.mockImplementation((p: string) => {
    if (p.includes('/sessions')) return Promise.resolve(SESSIONS);
    if (p.includes('/payments')) return Promise.resolve(PAYMENTS);
    if (p === '/v1/tenant/clients/40') return Promise.resolve({ ...CLIENT, emergencyContact: null, intakeSummary: null });
    return Promise.resolve([]);
  });
  return renderWithApp(
    <Routes>
      <Route path="/dashboard/clients/:id" element={<ClientDetailPage clients={[CLIENT] as any} setClients={() => undefined} canViewPayments={canViewPayments} />} />
    </Routes>,
    { route: '/dashboard/clients/40' },
  );
}

describe('client history', () => {
  it('lists the client’s sessions with a link to each session page', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Ada Ola' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Session history' }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Individual Therapy/ }).some((a) => a.getAttribute('href') === '/dashboard/sessions/900')).toBe(true));
  });
  it('shows the payments tab with totals', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Ada Ola' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
    await waitFor(() => expect(screen.getAllByText('₦35,000').length).toBeGreaterThan(0));
    expect(screen.getByText(/Outstanding/i)).toBeTruthy();
  });
  it('hides the payments tab from staff without the desk permission', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session history' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Payments' })).toBeNull();
  });
});
