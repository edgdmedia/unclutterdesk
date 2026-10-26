import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));
const { LapseNotice } = await import('../LapseNotice');

const NOTICE = {
  lapsing: true,
  lapsedAt: '2026-11-01T00:00:00Z',
  noticeFrom: '2026-11-08T00:00:00Z',
  downgradeAt: '2026-11-22T00:00:00Z',
  inNotice: true,
  sessions: [{ id: '500', startsAt: '2026-11-25T10:00:00Z', clientName: 'Ada Obi', practitionerName: 'Nkem Eze' }],
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});
afterEach(cleanup);

describe('the lapse notice (§5.4a)', () => {
  it('shows nothing when no plan is lapsing', async () => {
    get.mockResolvedValue({ lapsing: false });
    renderWithApp(<LapseNotice />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Renew plan' })).toBeNull();
  });

  it('during grace, asks for the renewal without a date or sessions', async () => {
    get.mockResolvedValue({ ...NOTICE, inNotice: false, sessions: [] });
    renderWithApp(<LapseNotice />);
    expect(await screen.findByText(/hasn't renewed\. Nothing has changed yet/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Renew plan' }).getAttribute('href')).toBe('/dashboard/settings/subscription');
  });

  it('in the notice period, gives the exact date and the sessions with staff who will be paused', async () => {
    get.mockResolvedValue(NOTICE);
    renderWithApp(<LapseNotice />);
    expect(await screen.findByText(/moves to the free plan on 22 November 2026/)).toBeTruthy();
    expect(screen.getByText(/Ada Obi with Nkem Eze/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Reschedule or cancel' }).getAttribute('href')).toBe('/dashboard/sessions/500');
  });

  it("lets the owner take a session into one of their own open times", async () => {
    get.mockImplementation(async (url: string) =>
      url === '/v1/billing/lapse'
        ? NOTICE
        : { slots: [
            { id: '900', startsAt: '2026-11-25T10:00:00Z', endsAt: '2026-11-25T10:50:00Z', isActive: true, booked: false },
            { id: '901', startsAt: '2026-11-25T11:00:00Z', endsAt: '2026-11-25T11:50:00Z', isActive: true, booked: true },
          ] },
    );
    post.mockResolvedValue({});
    renderWithApp(<LapseNotice />);
    fireEvent.click(await screen.findByRole('button', { name: 'Take it over' }));
    const times = await screen.findAllByRole('button', { name: /Wed 25 Nov/ });
    expect(times).toHaveLength(1); // the booked time isn't offered
    fireEvent.click(times[0]);
    await waitFor(() => expect(post).toHaveBeenCalledWith('/v1/consult/practice/sessions/500/reassign-to-me', { availabilityId: '900' }));
  });
});
