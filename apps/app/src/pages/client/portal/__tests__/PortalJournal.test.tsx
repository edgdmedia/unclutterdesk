import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { Suspense } from 'react';
import { Routes } from 'react-router-dom';
import { fireEvent, renderWithApp, screen, waitFor, cleanup } from '../../../../test/renderWithApp';

/**
 * The practitioner's daily plan on the client's recap page, added to her own
 * Unclutter Journal only when she chooses (docs/design/journal-integration.md),
 * and the page she comes back to from Journal.
 */
const apiGet = vi.fn();
const apiPut = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    put: (...a: unknown[]) => apiPut(...a),
    post: (...a: unknown[]) => apiPost(...a),
    delete: (...a: unknown[]) => apiDelete(...a),
    patch: vi.fn(),
    baseUrl: '',
  },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  getAppType: () => 'booking',
  TENANT_SLUG: 'dr-smith',
  API_BASE: '',
}));
vi.mock('../../../../context/AuthContext', () => {
  const auth = { isAuthenticated: true, profile: { email: 'ada@example.com', type: 'user', firstName: 'Ada', lastName: 'O' }, logout: vi.fn() };
  return { useAuth: () => auth, useOptionalAuth: () => auth };
});
vi.mock('../../../../components/RescheduleDialog', () => ({ RescheduleDialog: () => null }));

const { CLIENT_PORTAL_ROUTES } = await import('../../../../routes/clientRoutes');

const RECAP = {
  id: '900',
  serviceTitle: 'Individual Therapy',
  startsAt: '2026-11-05T17:00:00.000Z',
  therapistName: 'Olalekan O',
  sentAt: '2026-11-06T09:00:00.000Z',
  recap: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Good work today.' }] }] }),
  ticks: [],
  assessments: [],
};
const JOURNAL = {
  available: true,
  title: 'Reflection practice',
  intro: 'One small thing a day.',
  days: 7,
  connected: false,
  addedAt: null,
  deliveryTime: '08:00',
  progress: null,
  journalUrl: 'https://journal.example.test',
};

let journal: Record<string, unknown> = JOURNAL;
const assign = vi.fn();

beforeEach(() => {
  journal = JOURNAL;
  [apiGet, apiPut, apiPost, apiDelete, assign].forEach((f) => f.mockReset());
  apiGet.mockImplementation((path: string) => {
    if (path === '/v1/consult/portal/sessions/900/recap') return Promise.resolve(RECAP);
    if (path === '/v1/consult/portal/sessions/900/journal') return Promise.resolve(journal);
    if (path === '/v1/consult/portal') return Promise.resolve({ clientName: 'Ada', upcoming: [], past: [] });
    return Promise.resolve([]);
  });
  vi.stubGlobal('location', { ...window.location, assign });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderAt = (path: string) =>
  renderWithApp(<Suspense fallback={null}><Routes>{CLIENT_PORTAL_ROUTES}</Routes></Suspense>, { route: path });

describe('the Journal plan on the recap', () => {
  it('is not there when the practitioner wrote none', async () => {
    journal = { available: false };
    renderAt('/portal/sessions/900/recap');
    expect(await screen.findByText('Good work today.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add to my Unclutter Journal/ })).toBeNull();
  });

  it('says what is shared before she goes, and opens Journal in a new tab at the time she chose', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    apiPost.mockResolvedValue({ url: 'https://journal.example.test/link/desk?request=abc' });
    renderAt('/portal/sessions/900/recap');
    expect(await screen.findByRole('heading', { name: 'Reflection practice' })).toBeTruthy();
    expect(screen.getByText(/never your words unless you choose to share an entry/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Prompt time'), { target: { value: '07:30' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to my Unclutter Journal/ }));
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/v1/consult/portal/sessions/900/journal/connect', { deliveryTime: '07:30' }));
    await waitFor(() => expect(tab.location.href).toBe('https://journal.example.test/link/desk?request=abc'));
    expect(tab.opener).toBeNull();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByText(/is a free, private space to reflect/)).toBeTruthy();
  });

  it('goes in the same tab when pop-ups are blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    apiPost.mockResolvedValue({ url: 'https://journal.example.test/link/desk?request=abc' });
    renderAt('/portal/sessions/900/recap');
    fireEvent.click(await screen.findByRole('button', { name: /Add to my Unclutter Journal/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://journal.example.test/link/desk?request=abc'));
  });

  it('closes the new tab and explains when the link could not be made', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    apiPost.mockRejectedValue(new Error('Unclutter Journal could not be reached. Try again in a moment.'));
    renderAt('/portal/sessions/900/recap');
    fireEvent.click(await screen.findByRole('button', { name: /Add to my Unclutter Journal/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be reached/);
    expect(tab.close).toHaveBeenCalled();
  });

  it('adds it straight away once her Journal is connected', async () => {
    journal = { ...JOURNAL, connected: true };
    apiPut.mockImplementation(() => {
      journal = { ...JOURNAL, connected: true, addedAt: '2026-11-07T09:00:00.000Z', progress: { total: 7, responded: 0 } };
      return Promise.resolve({});
    });
    renderAt('/portal/sessions/900/recap');
    fireEvent.click(await screen.findByRole('button', { name: /Add to my Unclutter Journal/ }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/v1/consult/portal/sessions/900/journal/plan', { deliveryTime: '08:00' }));
    expect(await screen.findByText(/In your Unclutter Journal, each day at 08:00/)).toBeTruthy();
    expect(screen.getByText('0 of 7 days answered.')).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it('disconnects when she asks, after saying what that means', async () => {
    journal = { ...JOURNAL, connected: true, addedAt: '2026-11-07T09:00:00.000Z' };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiDelete.mockImplementation(() => {
      journal = JOURNAL;
      return Promise.resolve({ connected: false });
    });
    renderAt('/portal/sessions/900/recap');
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/v1/consult/portal/journal/link'));
    expect(await screen.findByRole('button', { name: /Add to my Unclutter Journal/ })).toBeTruthy();
  });
});

describe('back from Journal', () => {
  it('finishes the link once and returns to her recap, saying it was added', async () => {
    apiPost.mockResolvedValue({ bookingId: '900', linked: true, added: true, message: null });
    journal = { ...JOURNAL, connected: true, addedAt: '2026-11-07T09:00:00.000Z' };
    renderAt('/portal/journal/linked?code=one-time&state=nonce-1');
    expect(await screen.findByText(/Added to your Unclutter Journal/)).toBeTruthy();
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/v1/consult/portal/journal/link', { state: 'nonce-1', code: 'one-time' });
  });

  it('records that she said no', async () => {
    apiPost.mockResolvedValue({ bookingId: '900', linked: false, added: false, message: null });
    renderAt('/portal/journal/linked?error=declined&state=nonce-1');
    expect(await screen.findByText(/Nothing was connected/)).toBeTruthy();
    expect(apiPost).toHaveBeenCalledWith('/v1/consult/portal/journal/link', { state: 'nonce-1', error: 'declined' });
  });

  it('explains an expired link', async () => {
    apiPost.mockRejectedValue(new Error('This link has expired or was already used. Go back to your recap and try again.'));
    renderAt('/portal/journal/linked?code=x&state=old');
    expect((await screen.findByRole('alert')).textContent).toMatch(/expired/);
  });
});
