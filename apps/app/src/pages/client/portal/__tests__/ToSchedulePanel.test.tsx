import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

/**
 * §11.2 in the portal: a session already paid for with no time shows as
 * "Not scheduled", and the client books a time from the practitioner's open
 * times, straight away, with no payment step.
 */
const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) } }));

const { ToSchedulePanel } = await import('../ToSchedulePanel');

const ROW = { id: '50', serviceId: '2', serviceTitle: 'Individual Therapy', provider: { id: '6', name: 'Segun Ade' }, format: 'ONLINE', paymentMethod: 'PAYSTACK' };
const at = new Date(Date.now() + 3 * 86_400_000);
at.setUTCHours(10, 0, 0, 0);
const SLOT = { id: '301', startsAt: at.toISOString(), endsAt: new Date(at.getTime() + 50 * 60_000).toISOString(), channel: 'VIDEO' };

beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });
afterEach(cleanup);

function renderPanel(rows: unknown[] = [ROW]) {
  let current = rows;
  apiGet.mockImplementation((p: string) =>
    p === '/v1/consult/portal/plan-sessions'
      ? Promise.resolve(current)
      : p === '/v1/consult/portal/plan-sessions/50/options'
        ? Promise.resolve([SLOT])
        : Promise.resolve([]),
  );
  const onBooked = vi.fn();
  renderWithApp(<ToSchedulePanel onBooked={onBooked} />);
  return { onBooked, setRows: (r: unknown[]) => { current = r; } };
}

describe('sessions to schedule in the portal', () => {
  it('shows a paid session with no time', async () => {
    renderPanel();
    expect(await screen.findByText('Individual Therapy')).toBeTruthy();
    expect(screen.getByText(/with Segun Ade · Paid · Not scheduled/)).toBeTruthy();
  });

  it('books a chosen open time', async () => {
    const { onBooked, setRows } = renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Choose a time/ }));
    expect(await screen.findByRole('dialog', { name: 'Choose a time' })).toBeTruthy();
    expect(screen.getByText(/already paid/)).toBeTruthy();
    fireEvent.click((await screen.findByTestId('slot-301')).querySelector('input')!);
    apiPost.mockResolvedValue({ bookingId: '901' });
    setRows([]);
    fireEvent.click(screen.getByRole('button', { name: 'Book this time' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/portal/plan-sessions/50/schedule', { availabilityId: '301' }));
    await waitFor(() => expect(onBooked).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Individual Therapy')).toBeNull());
  });

  it('shows nothing when every paid session has a time', async () => {
    renderPanel([]);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'To schedule' })).toBeNull();
  });
});
