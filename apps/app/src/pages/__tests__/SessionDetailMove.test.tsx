import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/**
 * A client is tied up and asks for another time. Staff change it from Edit
 * session on the session page: to one of the practitioner's open times, or to
 * a time they type in when the client asks for one the weekly hours don't offer.
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

describe('editing when a booked session is', () => {
  it("offers the practitioner's open times for this service and format, without the current one", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        '/v1/consult/public/availability?providerProfileId=6&serviceId=2&format=ONLINE',
        expect.anything(),
      ),
    );
    expect(await screen.findByRole('dialog', { name: /Edit Ada Ola's session/ })).toBeTruthy();
    expect(await screen.findByTestId('slot-301')).toBeTruthy();
    // The session's own time is not a place to move it to.
    expect(screen.queryByTestId('slot-300')).toBeNull();
  });

  it('moves to an open time', async () => {
    renderPage();
    apiPost.mockResolvedValue({ id: '900', startsAt: SLOTS[1].startsAt });
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    fireEvent.click((await screen.findByTestId('slot-301')).querySelector('input')!);
    fireEvent.click(screen.getByRole('button', { name: /^Move to/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/reschedule', { availabilityId: '301' }));
    expect(await screen.findByText(/Session moved/)).toBeTruthy();
  });

  it('moves to a time staff type in', async () => {
    renderPage();
    apiPost.mockResolvedValue({ id: '900', startsAt: later.toISOString() });
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
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
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Custom time' }));
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2030-01-15T14:30' } });
    fireEvent.click(screen.getByRole('button', { name: /^Move to/ }));
    expect(await screen.findByText(/already has a session from 14:00/)).toBeTruthy();
  });

  it('a cancelled session cannot be edited', async () => {
    renderPage({ ...DETAIL, status: 'CANCELLED' });
    await screen.findByRole('heading', { name: 'Ada Ola' });
    expect(screen.queryByRole('button', { name: /Edit session/ })).toBeNull();
  });

  it('a completed session keeps its time; only its service can change', async () => {
    renderPage({ ...DETAIL, status: 'COMPLETED' });
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    await screen.findByRole('dialog', { name: /Edit Ada Ola's session/ });
    expect(screen.queryByRole('tab', { name: 'When' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Custom time' })).toBeNull();
  });

  // The client was tied up at the time: the session passed without happening.
  it('a session whose time has passed, not completed, can still move', async () => {
    const past = new Date(Date.now() - 3 * 3_600_000);
    renderPage({ ...DETAIL, startsAt: past.toISOString(), endsAt: new Date(past.getTime() + 50 * 60_000).toISOString() });
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    expect(await screen.findByRole('radio', { name: 'Custom time' })).toBeTruthy();
  });
});

// After a call in Google Meet the room is never reopened: the note is
// written on the session page, hours later, in the same editor as the room.
describe("the session's note on the session page", () => {
  const past = new Date(Date.now() - 5 * 3_600_000);
  const ended = { ...DETAIL, status: 'COMPLETED', startsAt: past.toISOString(), endsAt: new Date(past.getTime() + 50 * 60_000).toISOString(), can: { edit: true, summary: true, markPaid: false } };

  it('is there to write when none has been started, and saves against the session', async () => {
    renderPage(ended);
    const s = await screen.findByLabelText('Subjective');
    apiPost.mockResolvedValue({ id: '7', isLocked: false });
    fireEvent.change(s, { target: { value: 'Sleeps better' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/notes', expect.objectContaining({ bookingId: '900', clientProfileId: '40', subjective: 'Sleeps better' })));
  });

  it('carries on a draft', async () => {
    renderPage({ ...ended, note: { id: '7', status: 'DRAFT', subjective: 'Sleeps better', objective: '', assessment: '', plan: 'Breathing' } });
    expect(((await screen.findByLabelText('Plan')) as HTMLTextAreaElement).value).toBe('Breathing');
    expect(((screen.getByLabelText('Subjective')) as HTMLTextAreaElement).disabled).toBe(false);
  });

  it('signs and locks it', async () => {
    renderPage({ ...ended, note: { id: '7', status: 'DRAFT', subjective: 'x', objective: 'x', assessment: 'x', plan: 'x' } });
    apiPost.mockResolvedValue({ id: '7', isLocked: false });
    apiPatch.mockResolvedValue({ id: '7', isLocked: true });
    fireEvent.click(await screen.findByRole('button', { name: /Sign & lock/ }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/notes/7/lock', {}));
  });

  it('shows a signed note read-only', async () => {
    renderPage({ ...ended, note: { id: '7', status: 'COMPLETED', subjective: 'Sleeps better', objective: '', assessment: '', plan: '' } });
    expect(((await screen.findByLabelText('Subjective')) as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('is not shown to the desk', async () => {
    renderPage({ ...ended, can: { edit: true, summary: false, markPaid: true } });
    await screen.findByRole('heading', { name: 'Ada Ola' });
    expect(screen.queryByLabelText('Subjective')).toBeNull();
  });
});

// Never automatic: the practitioner chooses, per completed session, once.
describe('asking for a review', () => {
  const done = { ...DETAIL, status: 'COMPLETED', reviewRequestedAt: null };

  it('emails the client from a completed session, then says it was asked', async () => {
    const session: Record<string, unknown> = { ...done };
    renderPage(session);
    apiPost.mockImplementation(async () => {
      session.reviewRequestedAt = '2026-11-06T12:00:00.000Z';
      return { id: '900', reviewRequestedAt: session.reviewRequestedAt };
    });
    fireEvent.click(await screen.findByRole('button', { name: /Ask for a review/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/review-request', {}));
    expect(await screen.findByText(/Review requested/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ask for a review/ })).toBeNull();
  });

  it('is not offered twice', async () => {
    renderPage({ ...done, reviewRequestedAt: '2026-11-05T12:00:00.000Z' });
    expect(await screen.findByText(/Review requested/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ask for a review/ })).toBeNull();
  });

  it('is not offered before the session is completed', async () => {
    renderPage(DETAIL);
    await screen.findByRole('heading', { name: 'Ada Ola' });
    expect(screen.queryByRole('button', { name: /Ask for a review/ })).toBeNull();
  });

  it("shows the API's reason when it can't be sent", async () => {
    renderPage(done);
    apiPost.mockRejectedValue(new Error('Set up a review form under Forms first.'));
    fireEvent.click(await screen.findByRole('button', { name: /Ask for a review/ }));
    expect(await screen.findByText(/Set up a review form/)).toBeTruthy();
  });
});

// §11.2: the fourth of four sessions waits until the client knows when she is free.
describe('leaving a session for the client to schedule', () => {
  it('frees the time from Edit session, keeping the payment', async () => {
    const session: Record<string, unknown> = { ...DETAIL };
    renderPage(session);
    apiPost.mockImplementation(async () => {
      Object.assign(session, { status: 'CANCELLED', unscheduledAt: '2026-11-06T12:00:00.000Z' });
      return { planSessionId: '50' };
    });
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Client chooses later' }));
    expect(screen.getByText(/stays paid/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Let Ada Ola choose' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/unschedule', {}));
    expect(await screen.findByText(/Left for Ada Ola to schedule/)).toBeTruthy();
  });

  it('is not offered for an unpaid session, which is cancelled instead', async () => {
    renderPage({ ...DETAIL, status: 'PENDING_PAYMENT' });
    fireEvent.click(await screen.findByRole('button', { name: /Edit session/ }));
    await screen.findByRole('radio', { name: 'Custom time' });
    expect(screen.queryByRole('radio', { name: 'Client chooses later' })).toBeNull();
  });

  it('a session booked from it says it was paid earlier', async () => {
    renderPage({ ...DETAIL, paymentMethod: 'PLAN', amountKobo: '0' });
    expect(await screen.findByText('Paid on an earlier booking')).toBeTruthy();
  });
});
