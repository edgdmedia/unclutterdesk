import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/**
 * A client is tied up and asks for another time. Staff move the session from
 * the session page: to one of the practitioner's open times, or to a time
 * they type in when the client asks for one the weekly hours don't offer.
 */
const apiGet = vi.fn();
const apiPatch = vi.fn();
const apiPost = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    post: (...a: unknown[]) => apiPost(...a),
  },
  getBookingUrl: () => 'https://dr-smith.unclutterdesk.com',
  TENANT_SLUG: 'dr-smith',
}));

const auth = { profile: { id: '9', role: 'ADMIN', tenantSlug: 'dr-smith' } };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth, useOptionalAuth: () => auth }));

const { SessionDetailPage } = await import('../practice/SessionDetailPage');

const start = new Date(Date.now() + 2 * 86_400_000);
start.setUTCHours(10, 0, 0, 0);
const DETAIL = {
  id: '900', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 50 * 60_000).toISOString(),
  status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: '1000000', holdExpiresAt: null, bookedBy: null,
  client: { id: '40', name: 'Ada Ola' }, serviceId: '2', serviceTitle: 'Individual Session', durationMinutes: 50,
  provider: { id: '6', name: 'Segun Ade' }, channel: 'VIDEO',
  clientEmail: 'ada@example.com', clientPhone: null, videoRoomLink: '/session/900',
  note: null, internalSummary: null, clientRecap: null, clientRecapSentAt: null,
  format: 'ONLINE', location: null, balanceKobo: null, balanceStatus: null,
  can: { edit: true, summary: false, markPaid: true },
};
const later = new Date(start.getTime() + 86_400_000);
const SLOTS = [
  { id: '300', startsAt: DETAIL.startsAt, endsAt: DETAIL.endsAt, formats: ['ONLINE'] },
  { id: '301', startsAt: later.toISOString(), endsAt: new Date(later.getTime() + 50 * 60_000).toISOString(), formats: ['ONLINE'] },
];

beforeEach(() => { apiGet.mockReset(); apiPatch.mockReset(); apiPost.mockReset(); });
afterEach(cleanup);

function renderPage(detail: Record<string, unknown> = DETAIL) {
  apiGet.mockImplementation((p: string) =>
    p === '/v1/consult/practice/sessions/900'
      ? Promise.resolve(detail)
      : p.startsWith('/v1/consult/public/availability')
        ? Promise.resolve(SLOTS)
        : Promise.resolve([]),
  );
  return renderWithApp(
    <Routes><Route path="/dashboard/sessions/:id" element={<SessionDetailPage />} /></Routes>,
    { route: '/dashboard/sessions/900' },
  );
}

describe('moving a booked session', () => {
  it("offers the practitioner's open times for this service and format, without the current one", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Move session/ }));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        '/v1/consult/public/availability?providerProfileId=6&serviceId=2&format=ONLINE',
        expect.anything(),
      ),
    );
    expect(await screen.findByRole('dialog', { name: /Move Ada Ola's session/ })).toBeTruthy();
    expect(await screen.findByTestId('slot-301')).toBeTruthy();
    // The session's own time is not a place to move it to.
    expect(screen.queryByTestId('slot-300')).toBeNull();
  });

  it('moves to an open time', async () => {
    renderPage();
    apiPost.mockResolvedValue({ id: '900', startsAt: SLOTS[1].startsAt });
    fireEvent.click(await screen.findByRole('button', { name: /Move session/ }));
    fireEvent.click((await screen.findByTestId('slot-301')).querySelector('input')!);
    fireEvent.click(screen.getByRole('button', { name: /^Move to/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/reschedule', { availabilityId: '301' }));
    expect(await screen.findByText(/Session moved/)).toBeTruthy();
  });

  it('moves to a time staff type in', async () => {
    renderPage();
    apiPost.mockResolvedValue({ id: '900', startsAt: later.toISOString() });
    fireEvent.click(await screen.findByRole('button', { name: /Move session/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Custom time' }));
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2030-01-15T14:30' } });
    expect(screen.getByText(/runs for 50 minutes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Move to/ }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/reschedule', { startsAt: new Date('2030-01-15T14:30').toISOString() }),
    );
  });

  it("shows the API's reason when the time can't be used", async () => {
    renderPage();
    apiPost.mockRejectedValue(new Error('Segun Ade already has a session from 14:00 to 15:00. Choose another time.'));
    fireEvent.click(await screen.findByRole('button', { name: /Move session/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Custom time' }));
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2030-01-15T14:30' } });
    fireEvent.click(screen.getByRole('button', { name: /^Move to/ }));
    expect(await screen.findByText(/already has a session from 14:00/)).toBeTruthy();
  });

  it('a completed or cancelled session cannot be moved', async () => {
    for (const status of ['COMPLETED', 'CANCELLED']) {
      renderPage({ ...DETAIL, status });
      await screen.findByRole('heading', { name: 'Ada Ola' });
      expect(screen.queryByRole('button', { name: /Move session/ })).toBeNull();
      cleanup();
    }
  });
});

// After the session the room is closed; the note is still to write. The page
// links to the client's notes for this session (see ClientDetailSessionNote).
describe("the session's note, once it has started", () => {
  const past = new Date(Date.now() - 2 * 3_600_000);
  const ended = { ...DETAIL, status: 'COMPLETED', startsAt: past.toISOString(), endsAt: new Date(past.getTime() + 50 * 60_000).toISOString(), can: { edit: true, summary: true, markPaid: false } };

  it('links to write it when there is none', async () => {
    renderPage(ended);
    const link = await screen.findByRole('link', { name: /Write note/ });
    expect(link.getAttribute('href')).toBe('/dashboard/clients/40?tab=notes&booking=900');
  });

  it('links to finish a draft', async () => {
    renderPage({ ...ended, note: { id: '7', status: 'DRAFT' } });
    expect(await screen.findByRole('link', { name: /Finish note/ })).toBeTruthy();
  });

  it('offers nothing once the note is signed, or before the session', async () => {
    renderPage({ ...ended, note: { id: '7', status: 'COMPLETED' } });
    await screen.findByRole('heading', { name: 'Ada Ola' });
    expect(screen.queryByRole('link', { name: /(Write|Finish) note/ })).toBeNull();
    cleanup();
    renderPage({ ...DETAIL, can: { edit: true, summary: true, markPaid: false } });
    await screen.findByRole('heading', { name: 'Ada Ola' });
    expect(screen.queryByRole('link', { name: /(Write|Finish) note/ })).toBeNull();
  });
});
