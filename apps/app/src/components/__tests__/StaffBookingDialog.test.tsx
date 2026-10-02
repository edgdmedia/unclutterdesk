import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) },
  TENANT_SLUG: '',
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

function staffOf(rows: unknown[]) {
  return (path: string) => (path.startsWith('/v1/tenant/staff') ? Promise.resolve(rows) : routes(path));
}
const member = (id: string, firstName: string) => ({ kind: 'member', id, firstName, lastName: 'B', status: 'active', isTherapist: true });

describe('choosing the practitioner', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset().mockResolvedValue({ bookingId: '900', status: 'CONFIRMED' });
  });
  afterEach(cleanup);

  // A receptionist is never a practitioner. With one practitioner the picker was
  // hidden and every booking went in under the receptionist, which the server refuses.
  it('books a receptionist’s session with the practice’s only practitioner', async () => {
    role = 'RECEPTIONIST';
    apiGet.mockImplementation(staffOf([member('7', 'Ade')]));
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Practitioner')).toBeTruthy());
    expect((screen.getByLabelText('Practitioner') as HTMLSelectElement).value).toBe('7');
    fireEvent.click(screen.getByRole('radio', { name: /Therapy session/ }));
    await waitFor(() => expect(apiGet.mock.calls.some(([p]) => String(p).includes('providerProfileId=7'))).toBe(true));
    fireEvent.click(screen.getByRole('radio', { name: 'Custom time' }));
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-01T10:00' } });
    fireEvent.click(screen.getByRole('radio', { name: /No charge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Book session' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(apiPost.mock.calls[0][1]).toMatchObject({ providerProfileId: '7' });
  });

  it('starts a receptionist on the first practitioner when there are several', async () => {
    role = 'RECEPTIONIST';
    apiGet.mockImplementation(staffOf([member('7', 'Ade'), member('8', 'Bola')]));
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Practitioner')).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: /Therapy session/ }));
    // The times shown are the practitioner's, not the receptionist's (id 5), who has none.
    await waitFor(() => expect(apiGet.mock.calls.some(([p]) => String(p).includes('providerProfileId=7'))).toBe(true));
    expect(apiGet.mock.calls.some(([p]) => String(p).includes('providerProfileId=5'))).toBe(false);
  });

  it('keeps an owner who sees clients on their own diary, without a picker when they are the only one', async () => {
    role = 'OWNER';
    apiGet.mockImplementation(staffOf([member('5', 'Jane')]));
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: /Therapy session/ })).toBeTruthy());
    expect(screen.queryByLabelText('Practitioner')).toBeNull();
  });

  it('says so when the practice has no practitioner to book', async () => {
    role = 'RECEPTIONIST';
    apiGet.mockImplementation(staffOf([]));
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No practitioner can take bookings yet/)).toBeTruthy());
  });
});

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

  // SET-06: a time that allows both asks staff to choose.
  it('asks for a format on a both-formats slot and sends the choice', async () => {
    apiPost.mockResolvedValue({ bookingId: '901', status: 'PENDING_PAYMENT' });
    apiGet.mockImplementation((path: string) => {
      if (String(path).startsWith('/v1/consult/public/availability')) {
        return Promise.resolve([{ id: '300', startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: '', formats: ['ONLINE', 'IN_PERSON'], location: { name: 'Lekki clinic', city: 'Lagos' } }]);
      }
      if (String(path).startsWith('/v1/consult/public/services')) return Promise.resolve([{ id: '20', title: 'Therapy session', durationMinutes: 50, priceKobo: '2500000' }]);
      if (String(path).startsWith('/v1/tenant/staff')) return Promise.resolve([{ kind: 'member', id: '5', firstName: 'Jane', lastName: 'Smith', status: 'active', isTherapist: true }]);
      return Promise.resolve([]);
    });
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: /Therapy session/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: /Therapy session/ }));
    await waitFor(() => expect(screen.getByTestId('slot-300')).toBeTruthy());
    fireEvent.click(screen.getByTestId('slot-300'));
    fireEvent.click(await screen.findByRole('radio', { name: 'In person' }));
    fireEvent.click(screen.getByRole('radio', { name: /No charge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Book session' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(apiPost.mock.calls[0][1]).toMatchObject({ format: 'IN_PERSON' });
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
