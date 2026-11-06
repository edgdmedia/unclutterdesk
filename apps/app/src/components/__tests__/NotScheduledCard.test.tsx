import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/** §11.2 on the client page: staff choose the time for a paid session with none. */
const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) }, TENANT_SLUG: 'dr-smith' }));
const auth = { profile: { id: '9', role: 'ADMIN', tenantSlug: 'dr-smith' } };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth, useOptionalAuth: () => auth }));

const { NotScheduledCard } = await import('../booking/NotScheduledCard');

const ROW = { id: '50', serviceId: '2', serviceTitle: 'Individual Therapy', durationMinutes: 50, provider: { id: '6', name: 'Segun Ade' }, format: 'ONLINE', paymentMethod: 'PAYSTACK' };
const at = new Date(Date.now() + 3 * 86_400_000);
at.setUTCHours(10, 0, 0, 0);
const SLOT = { id: '301', startsAt: at.toISOString(), endsAt: new Date(at.getTime() + 50 * 60_000).toISOString() };

beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });
afterEach(cleanup);

function renderCard(rows: unknown[] = [ROW]) {
  apiGet.mockImplementation((p: string) =>
    p === '/v1/consult/practice/clients/40/plan-sessions' ? Promise.resolve(rows) : p.startsWith('/v1/consult/public/availability') ? Promise.resolve([SLOT]) : Promise.resolve([]),
  );
  const onScheduled = vi.fn();
  renderWithApp(<NotScheduledCard client={{ id: '40', name: 'Ada Ola' }} onScheduled={onScheduled} />);
  return { onScheduled };
}

describe('not-scheduled sessions on the client page', () => {
  it('lists them and books an open time for the client', async () => {
    const { onScheduled } = renderCard();
    expect(await screen.findByText(/with Segun Ade · Online · Paid/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Choose time/ }));
    expect(await screen.findByRole('dialog', { name: 'Choose a time for Ada Ola' })).toBeTruthy();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/v1/consult/public/availability?providerProfileId=6&serviceId=2&format=ONLINE', expect.anything()));
    fireEvent.click((await screen.findByTestId('slot-301')).querySelector('input')!);
    apiPost.mockResolvedValue({ bookingId: '901', startsAt: SLOT.startsAt });
    fireEvent.click(screen.getByRole('button', { name: /^Book / }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/plan-sessions/50/schedule', { availabilityId: '301' }));
    await waitFor(() => expect(onScheduled).toHaveBeenCalled());
  });

  it('offers a custom time too', async () => {
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /Choose time/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Custom time' }));
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2030-01-15T14:30' } });
    apiPost.mockResolvedValue({ bookingId: '901', startsAt: new Date('2030-01-15T14:30').toISOString() });
    fireEvent.click(screen.getByRole('button', { name: /^Book / }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/plan-sessions/50/schedule', { startsAt: new Date('2030-01-15T14:30').toISOString() }));
  });

  it('shows nothing when there are none', async () => {
    renderCard([]);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByText('NOT SCHEDULED')).toBeNull();
  });
});
