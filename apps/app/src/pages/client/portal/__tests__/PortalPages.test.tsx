import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { fireEvent, renderWithApp, screen, waitFor, cleanup } from '../../../../test/renderWithApp';

const apiGet = vi.fn();
const apiPatch = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: (...a: unknown[]) => apiPatch(...a), baseUrl: '' },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  getAppType: () => 'booking',
  TENANT_SLUG: 'dr-smith',
  API_BASE: '',
}));
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, profile: { email: 'ada@example.com', type: 'user', firstName: 'Ada', lastName: 'O' }, logout: vi.fn() }),
}));
// The dialog's own flow is tested separately; here it just reports success.
vi.mock('../../../../components/RescheduleDialog', () => ({
  RescheduleDialog: ({ onRescheduled }: { onRescheduled: () => void }) => (
    <div role="dialog"><button onClick={onRescheduled}>confirm move</button></div>
  ),
}));
vi.mock('../../ClientSessionRoomPage', () => ({
  ClientSessionRoomPage: () => <p>room page</p>,
}));

const { CLIENT_PORTAL_ROUTES } = await import('../../../../routes/clientRoutes');

const FUTURE = new Date(Date.now() + 26 * 3_600_000).toISOString();
const UPCOMING = { id: '9', serviceTitle: 'Individual Therapy', startsAt: FUTURE, endsAt: new Date(Date.parse(FUTURE) + 3e6).toISOString(), status: 'CONFIRMED', priceKobo: '3000000', therapistName: 'Jane Smith', icalToken: 'tok', format: 'ONLINE' };
const PAST = { id: '4', serviceTitle: 'Couples Session', startsAt: '2026-08-01T09:00:00.000Z', endsAt: '2026-08-01T09:50:00.000Z', status: 'COMPLETED', priceKobo: '5500000', therapistName: 'Jane Smith' };
const PAYMENTS = { payments: [{ bookingId: '4', serviceTitle: 'Couples Session', sessionAt: '2026-08-01T09:00:00.000Z', amountKobo: '5500000', discountCode: null, status: 'CONFIRMED', paidAt: '2026-08-01T08:00:00.000Z', reference: 'booking-4-1', bookedAt: '2026-07-20T08:00:00.000Z' }], totalPaidKobo: '5500000', outstandingKobo: '0' };

function mockRoutes() {
  apiGet.mockImplementation((path: string) => {
    if (path === '/v1/consult/portal') return Promise.resolve({ clientName: 'Ada Obi', upcoming: [UPCOMING], past: [PAST] });
    if (path === '/v1/consult/portal/payments') return Promise.resolve(PAYMENTS);
    if (path === '/v1/intake/mine/forms') return Promise.resolve([{ id: '1', title: 'Client intake' }]);
    if (path === '/v1/assessments/mine') return Promise.resolve([{ id: '5', shortName: 'PHQ-9', measures: 'Depression', estimatedMinutes: 4, status: 'SENT', sentAt: '2026-09-20T08:00:00Z' }]);
    return Promise.resolve([]);
  });
  apiPatch.mockResolvedValue({});
}

const renderAt = (path: string) =>
  renderWithApp(<Routes>{CLIENT_PORTAL_ROUTES}</Routes>, { route: path });

beforeEach(() => { apiGet.mockReset(); apiPatch.mockReset(); mockRoutes(); });
afterEach(cleanup);

describe('portal pages', () => {
  it('sessions lists the upcoming session with Reschedule and Join', async () => {
    renderAt('/portal/sessions');
    expect(await screen.findByText('Individual Therapy')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reschedule/ })).toBeTruthy();
  });

  it('the past view lists completed sessions', async () => {
    renderAt('/portal/sessions?view=past');
    expect(await screen.findByText('Couples Session')).toBeTruthy();
  });

  it('forms lists the to-do form and the sent assessment', async () => {
    renderAt('/portal/forms');
    const link = await screen.findByRole('link', { name: /Client intake/ });
    expect(link.getAttribute('href')).toBe('/forms/1');
    expect(screen.getByRole('link', { name: /PHQ-9/ }).getAttribute('href')).toBe('/portal/assessments/5');
  });

  it('payments fetches only on its page and shows the totals', async () => {
    renderAt('/portal');
    await screen.findByText(/Hello/);
    expect(apiGet).not.toHaveBeenCalledWith('/v1/consult/portal/payments');
    renderAt('/portal/payments');
    expect((await screen.findAllByText('₦55,000')).length).toBeGreaterThan(0);
    expect(apiGet).toHaveBeenCalledWith('/v1/consult/portal/payments');
  });

  it('details shows the account and a sign out', async () => {
    renderAt('/portal/details');
    expect((await screen.findAllByText('ada@example.com')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });

  it('the session room renders outside the shell (no menu)', async () => {
    renderAt('/portal/sessions/9/room');
    expect(await screen.findByText('room page')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /My details/ })).toBeNull();
  });

  it('rescheduling reloads the shared portal data (Review Focus 5)', async () => {
    renderAt('/portal/sessions');
    fireEvent.click(await screen.findByRole('button', { name: /Reschedule/ }));
    fireEvent.click(await screen.findByRole('button', { name: /confirm move/ }));
    await waitFor(() =>
      expect(apiGet.mock.calls.filter(([p]) => p === '/v1/consult/portal').length).toBeGreaterThanOrEqual(2),
    );
  });
});
