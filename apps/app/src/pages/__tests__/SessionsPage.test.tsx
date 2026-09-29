import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor, within } from '../../test/renderWithApp';

const apiGet = vi.fn();
vi.mock('../../utils/apiClient', () => ({ api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn() } }));

const { SessionsPage } = await import('../practice/SessionsPage');

const ROWS = [
  { id: '1', startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), endsAt: '', status: 'CONFIRMED', paymentMethod: 'PAYSTACK', amountKobo: '3500000', holdExpiresAt: null, bookedBy: null, client: { id: '40', name: 'Ada Ola' }, serviceTitle: 'Individual Therapy', provider: { id: '6', name: 'Segun Ade' }, channel: 'VIDEO' },
];

afterEach(() => { cleanup(); apiGet.mockReset(); });

const renderPage = (can = { viewAll: true }) => {
  apiGet.mockImplementation((path: string) => {
    if (path.startsWith('/v1/consult/practice/sessions')) return Promise.resolve(ROWS);
    return Promise.resolve([]);
  });
  return renderWithApp(<SessionsPage can={can as any} />, { route: '/dashboard/sessions' });
};

describe('SessionsPage', () => {
  it('lists sessions with a link to each', async () => {
    renderPage();
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Ada Ola')).toBeTruthy());
    expect(within(screen.getByRole('table')).getByRole('link', { name: /Ada Ola/ }).getAttribute('href')).toBe('/dashboard/sessions/1');
  });
  it('tabs change what is asked for', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Past' }));
    await waitFor(() => expect(apiGet.mock.calls.some((c: string[]) => c[0].includes('status=past'))).toBe(true));
  });
  it('searches through the API', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sessions' }), { target: { value: 'ada' } });
    await waitFor(() => expect(apiGet.mock.calls.some((c: string[]) => c[0].includes('q=ada'))).toBe(true));
  });
  it('hides the practitioner column from non-view-all staff', async () => {
    renderPage({ viewAll: false });
    await waitFor(() => expect(screen.getByRole('table')).toBeTruthy());
    expect(screen.queryByText('Practitioner')).toBeNull();
  });
});
