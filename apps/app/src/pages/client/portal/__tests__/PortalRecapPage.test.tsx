import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { Suspense } from 'react';
import { Routes } from 'react-router-dom';
import { fireEvent, renderWithApp, screen, waitFor, cleanup } from '../../../../test/renderWithApp';

/**
 * The recap as a page in the client's portal: formatted as the practitioner
 * wrote it, tick-boxes the client ticks off (saved), and questionnaires sent
 * with it to start from here.
 */
const apiGet = vi.fn();
const apiPut = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), put: (...a: unknown[]) => apiPut(...a), post: vi.fn(), patch: vi.fn(), baseUrl: '' },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  getAppType: () => 'booking',
  TENANT_SLUG: 'dr-smith',
  API_BASE: '',
}));
vi.mock('../../../../context/AuthContext', () => {
  const auth = { isAuthenticated: true, profile: { email: 'ada@example.com', type: 'user', firstName: 'Ada', lastName: 'O' }, logout: vi.fn() };
  return { useAuth: () => auth, useOptionalAuth: () => auth };
});

// Not part of this page; the sessions list imports it.
vi.mock('../../../../components/RescheduleDialog', () => ({ RescheduleDialog: () => null }));

const { CLIENT_PORTAL_ROUTES } = await import('../../../../routes/clientRoutes');

const t = (text: string) => ({ type: 'text', text });
const task = (text: string) => ({ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [t(text)] }] });
const RECAP = {
  id: '900',
  serviceTitle: 'Individual Therapy',
  startsAt: '2026-11-05T17:00:00.000Z',
  therapistName: 'Olalekan O',
  sentAt: '2026-11-06T09:00:00.000Z',
  recap: JSON.stringify({ type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [t('Your next steps')] },
    { type: 'taskList', content: [task('Day 1'), task('Day 2')] },
  ] }),
  ticks: [false, false],
  assessments: [
    { id: '71', key: 'DAR_5', shortName: 'DAR-5', name: 'Dimensions of Anger Reactions (DAR-5)', estimatedMinutes: 2, status: 'SENT' },
    { id: '72', key: 'RSES', shortName: 'Rosenberg', name: 'Rosenberg Self-Esteem Scale (RSES)', estimatedMinutes: 3, status: 'COMPLETED' },
  ],
};
const PAST = { id: '900', serviceTitle: 'Individual Therapy', startsAt: RECAP.startsAt, endsAt: '2026-11-05T17:50:00.000Z', status: 'COMPLETED', priceKobo: '0', therapistName: 'Olalekan O', recapSentAt: RECAP.sentAt };

beforeEach(() => {
  apiGet.mockReset();
  apiPut.mockReset();
  apiGet.mockImplementation((path: string) => {
    if (path === '/v1/consult/portal/sessions/900/recap') return Promise.resolve(RECAP);
    if (path === '/v1/consult/portal/payments') return Promise.resolve({ payments: [], totalPaidKobo: '0', outstandingKobo: '0' });
    if (path === '/v1/consult/portal') return Promise.resolve({ clientName: 'Ada', upcoming: [], past: [PAST, { ...PAST, id: '901', recapSentAt: null }] });
    return Promise.resolve([]);
  });
  apiPut.mockImplementation((_p: string, body: { ticks: boolean[] }) => Promise.resolve({ ticks: body.ticks }));
});
afterEach(() => cleanup());

// The pages load lazily; the app renders them under a loading boundary, and so does this.
const renderAt = (path: string) =>
  renderWithApp(<Suspense fallback={null}><Routes>{CLIENT_PORTAL_ROUTES}</Routes></Suspense>, { route: path });

describe('the recap in the portal', () => {
  it('shows the recap formatted, with the session it belongs to', async () => {
    renderAt('/portal/sessions/900/recap');
    expect(await screen.findByRole('heading', { name: 'Your next steps' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Individual Therapy' })).toBeTruthy();
    expect(screen.getByText(/with Olalekan O/)).toBeTruthy();
  });

  it('saves a tick as soon as it is made', async () => {
    renderAt('/portal/sessions/900/recap');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Day 1' }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/v1/consult/portal/sessions/900/recap/ticks', { ticks: [true, false] }));
    expect(screen.getByText('1 of 2 ticked off. Your ticks are saved for you.')).toBeTruthy();
  });

  it('says so when a tick was not saved', async () => {
    apiPut.mockRejectedValue(new Error('offline'));
    renderAt('/portal/sessions/900/recap');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Day 2' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/not saved/);
  });

  it('starts a questionnaire sent with it, and shows one already done', async () => {
    renderAt('/portal/sessions/900/recap');
    const start = await screen.findByRole('link', { name: 'Start DAR-5' });
    expect(start.getAttribute('href')).toBe('/portal/assessments/71');
    expect(screen.queryByRole('link', { name: 'Start Rosenberg' })).toBeNull();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('explains when the recap cannot be opened', async () => {
    apiGet.mockImplementation(() => Promise.reject(new Error('Recap not found')));
    renderAt('/portal/sessions/900/recap');
    expect((await screen.findByRole('alert')).textContent).toBe('Recap not found');
  });

  it('is reached from the sessions it was sent for, and only those', async () => {
    renderAt('/portal/sessions?view=past');
    const links = await screen.findAllByRole('link', { name: 'Read recap' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/portal/sessions/900/recap');
  });
});
