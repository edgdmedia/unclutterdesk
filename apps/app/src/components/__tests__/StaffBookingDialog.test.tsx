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

// A client paid for four sessions by transfer and books two now: today 20:00 and tomorrow 14:00.
describe('booking several sessions at once', () => {
  beforeEach(() => {
    role = 'OWNER';
    apiGet.mockReset().mockImplementation(routes);
    apiPost.mockReset().mockResolvedValue({ bookings: [{ bookingId: '900', status: 'CONFIRMED' }, { bookingId: '901', status: 'CONFIRMED' }] });
  });
  afterEach(cleanup);

  async function start() {
    const onBooked = vi.fn();
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={onBooked} />);
    fireEvent.click(await screen.findByRole('radio', { name: /Therapy session/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Custom time' }));
    return onBooked;
  }

  it('adds times to a list and books them together, marked as paid', async () => {
    const onBooked = await start();
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-01T20:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Add another time/ }));
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-02T14:00' } });
    fireEvent.click(screen.getByRole('radio', { name: /Mark as paid/ }));
    expect(screen.getByText(/Booking 2 sessions/)).toBeTruthy();
    expect(screen.getByText(/Amount received per session/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Book 2 sessions' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    const [path, body] = apiPost.mock.calls[0];
    expect(path).toBe('/v1/consult/practice/bookings/several');
    expect(body).toMatchObject({ clientProfileId: '40', serviceId: '20', payment: 'PAID' });
    expect(body.times).toHaveLength(2);
    expect(body.times[0].startsAt).toBe(new Date('2026-12-01T20:00').toISOString());
    expect(body.times[1].startsAt).toBe(new Date('2026-12-02T14:00').toISOString());
    await waitFor(() => expect(onBooked).toHaveBeenCalled());
  });

  it('books from the list alone once the last time is added, and a time can be removed', async () => {
    await start();
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-01T20:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Add another time/ }));
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-02T14:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Add another time/ }));
    expect(screen.getByRole('button', { name: 'Book 2 sessions' })).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /^Remove/ })[0]);
    fireEvent.click(screen.getByRole('radio', { name: /No charge/ }));
    apiPost.mockResolvedValue({ bookingId: '901', status: 'CONFIRMED' });
    fireEvent.click(screen.getByRole('button', { name: 'Book session' }));
    // One left: the single-booking endpoint, as before.
    await waitFor(() => expect(apiPost.mock.calls[0][0]).toBe('/v1/consult/practice/bookings'));
    expect(apiPost.mock.calls[0][1]).toMatchObject({ startsAt: new Date('2026-12-02T14:00').toISOString() });
  });

  it('one time still books as a single session', async () => {
    await start();
    apiPost.mockResolvedValue({ bookingId: '900', status: 'CONFIRMED' });
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-12-01T20:00' } });
    fireEvent.click(screen.getByRole('radio', { name: /No charge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Book session' }));
    await waitFor(() => expect(apiPost.mock.calls[0][0]).toBe('/v1/consult/practice/bookings'));
  });
});

// §11.2: the client pays the desk for several sessions and chooses the times later.
describe('sessions paid at the practice, times chosen later', () => {
  beforeEach(() => {
    apiGet.mockReset().mockImplementation(staffOf([member('5', 'Jane')]));
    apiPost.mockReset().mockResolvedValue({ count: 4, planSessionIds: ['50', '51', '52', '53'] });
  });
  afterEach(cleanup);

  it('adds them paid, with no time, for the client to schedule', async () => {
    role = 'OWNER';
    const onBooked = vi.fn();
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={onBooked} />);
    fireEvent.click(await screen.findByRole('radio', { name: /Therapy session/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Client chooses later' }));
    fireEvent.change(screen.getByLabelText('How many sessions'), { target: { value: '4' } });
    // A payment link needs a time to hold: not offered here.
    expect(screen.queryByRole('radio', { name: /Send a payment link/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Mark as paid/ }));
    fireEvent.change(screen.getByLabelText('Amount received per session (₦)'), { target: { value: '25000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add 4 sessions to schedule later' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/plan-sessions', {
      clientProfileId: '40', serviceId: '20', providerProfileId: '5', count: 4, format: 'ONLINE', locationId: undefined,
      payment: 'PAID', amountKobo: '2500000', notifyClient: true,
    }));
    expect(onBooked).toHaveBeenCalledWith({ count: 4, planSessionIds: ['50', '51', '52', '53'] });
  });

  it('a therapist adds them at no charge', async () => {
    role = 'THERAPIST';
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    fireEvent.click(await screen.findByRole('radio', { name: /Therapy session/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Client chooses later' }));
    expect((screen.getByRole('radio', { name: /No charge/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add session to schedule later' }));
    await waitFor(() => expect(apiPost.mock.calls[0][1]).toMatchObject({ count: 1, payment: 'NONE' }));
  });

  it('needs a whole number from 1 to 12', async () => {
    role = 'OWNER';
    render(<StaffBookingDialog client={{ id: '40', name: 'Ada Ola' }} onClose={() => {}} onBooked={() => {}} />);
    fireEvent.click(await screen.findByRole('radio', { name: /Therapy session/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Client chooses later' }));
    fireEvent.change(screen.getByLabelText('How many sessions'), { target: { value: '13' } });
    expect((screen.getByRole('button', { name: /to schedule later/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
