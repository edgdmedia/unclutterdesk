import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) },
}));
let role = 'OWNER';
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ profile: { id: '5', role } }) }));

const { StaffBookingDialog } = await import('../booking/StaffBookingDialog');

const soon = new Date(Date.now() + 5 * 86_400_000).toISOString();

function routes(path: string) {
  if (path.startsWith('/v1/consult/public/services')) return Promise.resolve([{ id: '20', title: 'Therapy session', durationMinutes: 50, priceKobo: '2500000' }]);
  if (path.startsWith('/v1/tenant/staff')) return Promise.resolve([{ kind: 'member', id: '5', firstName: 'Jane', lastName: 'Smith', status: 'active', isTherapist: true }]);
  if (path.startsWith('/v1/consult/public/availability')) return Promise.resolve([{ id: '300', startsAt: soon, endsAt: soon }]);
  return Promise.resolve([]);
}

describe('StaffBookingDialog', () => {
  beforeEach(() => {
    role = 'OWNER';
    apiGet.mockReset().mockImplementation(routes);
    apiPost.mockReset();
  });
  afterEach(cleanup);

  it('books an open slot with a payment link', async () => {
    apiPost.mockResolvedValue({ bookingId: '900', status: 'PENDING_PAYMENT' });
    const onBooked = vi.fn();
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={onBooked} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: /Therapy session/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: /Therapy session/ }));
    await waitFor(() => expect(screen.getAllByRole('radio', { name: /am|pm|:\d\d/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByTestId('slot-300'));
    fireEvent.click(screen.getByRole('radio', { name: /Send a payment link/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Book session' }));
    await waitFor(() => expect(onBooked).toHaveBeenCalled());
    expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/bookings', expect.objectContaining({
      clientProfileId: '40', serviceId: '20', providerProfileId: '5', availabilityId: '300', payment: 'LINK', notifyClient: true,
    }));
  });

  it('does not offer "mark as paid" to a therapist', async () => {
    role = 'THERAPIST';
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: /Send a payment link/ })).toBeTruthy());
    expect(screen.queryByRole('radio', { name: /Mark as paid/ })).toBeNull();
  });

  it('shows the server’s reason when booking fails', async () => {
    apiPost.mockRejectedValue(new Error('Jane Smith already has a session from 10:00 to 10:50 (UTC). Choose another time.'));
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    await waitFor(() => screen.getByRole('radio', { name: /Therapy session/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Therapy session/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Custom time' }));
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-01T10:00' } });
    fireEvent.click(screen.getByRole('radio', { name: /No charge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Book session' }));
    await waitFor(() => expect(screen.getByText(/already has a session/)).toBeTruthy());
  });
});
