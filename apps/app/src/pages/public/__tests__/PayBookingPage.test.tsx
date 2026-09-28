import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) },
}));
const { PayBookingPage } = await import('../PayBookingPage');

const summary = { state: 'PAYABLE', serviceTitle: 'Therapy session', practitionerName: 'Jane Smith', startsAt: '2026-10-05T09:00:00Z', amountKobo: '2500000', practiceName: 'Smith Therapy' };

const renderAt = (url: string) =>
  render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/pay/:bookingId" element={<PayBookingPage />} /></Routes></MemoryRouter>);

describe('PayBookingPage', () => {
  const assign = vi.fn();
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    assign.mockReset();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });
  });
  afterEach(cleanup);

  it('shows what is owed and sends the client to checkout', async () => {
    apiGet.mockResolvedValue(summary);
    apiPost.mockResolvedValue({ paymentUrl: 'https://checkout.paystack.com/abc' });
    renderAt('/pay/900?t=tok');
    await waitFor(() => expect(screen.getByText('Therapy session')).toBeTruthy());
    expect(apiGet).toHaveBeenCalledWith('/v1/consult/public/bookings/900/pay-link?t=tok');
    fireEvent.click(screen.getByRole('button', { name: /Pay ₦25,000/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/abc'));
    expect(apiPost).toHaveBeenCalledWith('/v1/consult/public/bookings/900/pay-link', { t: 'tok' });
  });

  it('says so when the session is already paid', async () => {
    apiGet.mockResolvedValue({ ...summary, state: 'PAID' });
    renderAt('/pay/900?t=tok');
    await waitFor(() => expect(screen.getByText('This session is already paid.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Pay/ })).toBeNull();
  });

  it('says so when the hold lapsed', async () => {
    apiGet.mockResolvedValue({ ...summary, state: 'LAPSED' });
    renderAt('/pay/900?t=tok');
    await waitFor(() => expect(screen.getByText(/no longer held/)).toBeTruthy());
  });

  it('explains a broken link', async () => {
    apiGet.mockRejectedValue(new Error('This payment link is not valid.'));
    renderAt('/pay/900?t=bad');
    await waitFor(() => expect(screen.getByText('This payment link is not valid.')).toBeTruthy());
  });
});
