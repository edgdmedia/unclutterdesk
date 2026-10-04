import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithApp, screen, waitFor, cleanup } from '../../../../test/renderWithApp';
import React from 'react';

/**
 * POR-03: the Payments page, moved out of the old tab. The amounts it shows
 * are the ones recorded on each booking, not the service's price today — the
 * service price moves when the practice reprices and is simply wrong for a
 * discounted booking, so showing it would tell clients they paid something
 * they did not.
 */
const apiGet = vi.fn();

vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...args: unknown[]) => apiGet(...args), post: vi.fn(), patch: vi.fn(), baseUrl: '' },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  getAppType: () => 'booking',
  TENANT_SLUG: 'dr-smith',
  API_BASE: '',
}));

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, profile: { email: 'ada@example.com', type: 'user' }, logout: vi.fn() }),
}));

const { PortalDataProvider } = await import('../PortalDataContext');
const { PortalPaymentsPage } = await import('../PortalPaymentsPage');

const PORTAL = { clientName: 'Ada Obi', upcoming: [], past: [] };

const PAYMENTS = {
  totalPaidKobo: '500000',
  outstandingKobo: '300000',
  payments: [
    {
      bookingId: '1', serviceTitle: 'Therapy', sessionAt: '2026-08-05T10:00:00Z', amountKobo: '500000',
      discountCode: 'SAVE10', status: 'CONFIRMED', paidAt: '2026-08-01T10:00:00Z',
      reference: 'booking-1-1725000000', bookedAt: '2026-07-30T09:00:00Z',
    },
    {
      bookingId: '2', serviceTitle: 'Follow-up', sessionAt: '2026-09-20T10:00:00Z', amountKobo: '300000',
      discountCode: null, status: 'PENDING_PAYMENT', paidAt: null, reference: null, bookedAt: '2026-09-01T09:00:00Z',
    },
  ],
};

function route(path: string) {
  if (path === '/v1/consult/portal') return Promise.resolve(PORTAL);
  if (path === '/v1/consult/portal/payments') return Promise.resolve(PAYMENTS);
  if (path.startsWith('/v1/intake/public/forms')) return Promise.resolve([]);
  if (path === '/v1/intake/mine/forms') return Promise.resolve([{ id: '1' }, { id: '2' }]);
  return Promise.reject(new Error(`unexpected ${path}`));
}

function openPayments() {
  return renderWithApp(<PortalDataProvider><PortalPaymentsPage /></PortalDataProvider>);
}

beforeEach(() => {
  apiGet.mockReset().mockImplementation((path: string) => route(path));
});

afterEach(cleanup);

describe('the Payments page', () => {
  it('fetches its own data on mount', async () => {
    openPayments();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/v1/consult/portal/payments'));
  });

  it('shows what was charged for each session', async () => {
    openPayments();
    // ₦5,000 also appears as the total paid, hence findAllByText.
    expect((await screen.findAllByText('₦5,000')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('₦3,000').length).toBeGreaterThan(0);
  });

  it('names the discount that was applied', async () => {
    openPayments();
    expect(await screen.findByText(/SAVE10 applied/)).toBeTruthy();
  });

  it('shows the reference so a bank statement can be matched', async () => {
    openPayments();
    expect(await screen.findByText(/booking-1-1725000000/)).toBeTruthy();
  });

  describe('what each row is called', () => {
    it('marks a session that was actually paid for', async () => {
      openPayments();
      expect(await screen.findByText('Paid')).toBeTruthy();
    });

    it('marks one that is still owed', async () => {
      openPayments();
      expect(await screen.findByText('Awaiting payment')).toBeTruthy();
    });

    // A CONFIRMED booking with no paidAt was free, not paid — calling it paid
    // would put a charge in the client's history that never happened.
    it('calls a free session no charge rather than paid', async () => {
      apiGet.mockImplementation((path: string) =>
        path === '/v1/consult/portal/payments'
          ? Promise.resolve({
              totalPaidKobo: '0',
              outstandingKobo: '0',
              payments: [
                { ...PAYMENTS.payments[0], paidAt: null, amountKobo: '0', reference: null },
              ],
            })
          : route(path),
      );
      openPayments();
      expect(await screen.findByText('No charge')).toBeTruthy();
      expect(screen.queryByText('Paid')).toBeNull();
    });

    it('marks a cancelled session as cancelled', async () => {
      apiGet.mockImplementation((path: string) =>
        path === '/v1/consult/portal/payments'
          ? Promise.resolve({
              totalPaidKobo: '0',
              outstandingKobo: '0',
              payments: [{ ...PAYMENTS.payments[1], status: 'CANCELLED', amountKobo: '0' }],
            })
          : route(path),
      );
      openPayments();
      expect(await screen.findByText('Cancelled')).toBeTruthy();
      expect(screen.queryByText('Awaiting payment')).toBeNull();
    });
  });

  describe('the totals', () => {
    it('shows the total paid and what is outstanding', async () => {
      openPayments();
      await screen.findByText('TOTAL PAID');
      expect(screen.getByText('OUTSTANDING')).toBeTruthy();
    });
  });

  it('explains an empty history instead of showing a blank panel', async () => {
    apiGet.mockImplementation((path: string) =>
      path === '/v1/consult/portal/payments'
        ? Promise.resolve({ payments: [], totalPaidKobo: '0', outstandingKobo: '0' })
        : route(path),
    );
    openPayments();
    expect(await screen.findByText(/No payments yet/i)).toBeTruthy();
  });

  it('reports a failure rather than showing zero as if it were the answer', async () => {
    apiGet.mockImplementation((path: string) =>
      path === '/v1/consult/portal/payments'
        ? Promise.reject(new Error('Unable to load your payment history'))
        : route(path),
    );
    openPayments();
    expect(await screen.findByText(/Unable to load your payment history/i)).toBeTruthy();
  });

  // The old tab used to say so in as many words.
  it('never claims payments are unwired', async () => {
    const { container } = openPayments();
    await screen.findByText('TOTAL PAID');
    expect(container.textContent).not.toMatch(/not wired/);
  });

  it('shows the outstanding total in warning colour', async () => {
    openPayments();
    const owed = await screen.findByText('OUTSTANDING');
    expect(owed.parentElement?.querySelector('.text-\\[\\#B45309\\]')).toBeTruthy();
  });
});
