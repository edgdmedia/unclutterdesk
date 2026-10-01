import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

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

const { SessionDetailPage } = await import('../practice/SessionDetailPage');

const DETAIL = {
  id: '900', startsAt: '2026-10-01T09:00:00.000Z', endsAt: '2026-10-01T09:50:00.000Z',
  status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: '3500000', holdExpiresAt: null, bookedBy: 'Frank Desk',
  client: { id: '40', name: 'Ada Ola' }, serviceTitle: 'Individual Therapy',
  provider: { id: '6', name: 'Segun Ade' }, channel: 'VIDEO',
  clientEmail: 'ada@example.com', clientPhone: '0801', videoRoomLink: 'https://meet.jit.si/room-9',
  note: null, internalSummary: null, clientRecap: null, clientRecapSentAt: null,
  can: { edit: true, summary: true, markPaid: true },
};

beforeEach(() => { apiGet.mockReset(); apiPatch.mockReset(); apiPost.mockReset(); });
afterEach(cleanup);

function renderPage(detail = DETAIL, submissions: unknown[] = []) {
  apiGet.mockImplementation((p: string) =>
    p === '/v1/consult/practice/sessions/900' ? Promise.resolve(detail) : p === '/v1/intake/submissions/booking/900' ? Promise.resolve(submissions) : Promise.resolve([]),
  );
  return renderWithApp(
    <Routes><Route path="/dashboard/sessions/:id" element={<SessionDetailPage />} /></Routes>,
    { route: '/dashboard/sessions/900' },
  );
}

describe('SessionDetailPage', () => {
  it('shows who, what, when and who booked it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ada Ola' })).toBeTruthy());
    expect(screen.getByText('Individual Therapy')).toBeTruthy();
    expect(screen.getByText(/Segun Ade/)).toBeTruthy();
    expect(screen.getByText(/Booked by Frank Desk/)).toBeTruthy();
  });
  it('start and prep point at the existing flows', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.getByRole('link', { name: /Start session/ }).getAttribute('href')).toBe('/session/900');
    expect(screen.getByRole('link', { name: /Session prep/ }).getAttribute('href')).toBe('/session/900/prep');
  });
  it('saves the summary and sends the recap', async () => {
    apiPatch.mockResolvedValue({ id: '900' });
    apiPost.mockResolvedValue({ id: '900', sentAt: new Date().toISOString() });
    renderPage();
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    fireEvent.change(screen.getByLabelText('Client recap'), { target: { value: 'Practised breathing.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/summary', expect.objectContaining({ clientRecap: 'Practised breathing.' })));
    fireEvent.click(screen.getByRole('button', { name: /Send recap/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/practice/sessions/900/recap-email', {}));
  });
  it('hides what the caller may not do', async () => {
    renderPage({ ...DETAIL, can: { edit: false, summary: false, markPaid: false } });
    await waitFor(() => screen.getByRole('heading', { name: 'Ada Ola' }));
    expect(screen.queryByRole('button', { name: /Mark as paid/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cancel session/ })).toBeNull();
  });
});


describe('the default forms on a session', () => {
  it('shows intake and confidentiality as waiting when nothing is in', async () => {
    renderPage();
    const line = await screen.findByText(/Intake: waiting/);
    expect(line.parentElement?.textContent).toMatch(/Confidentiality: waiting/);
  });

  it('shows them as done when the submissions are in', async () => {
    renderPage(DETAIL, [{ targetType: 'INTAKE' }, { targetType: 'CONSENT' }]);
    const line = await screen.findByText(/Intake: done/);
    expect(line.parentElement?.textContent).toMatch(/Confidentiality: done/);
  });
});
