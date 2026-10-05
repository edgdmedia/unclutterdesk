import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { renderWithApp, screen, cleanup } from '../../../../test/renderWithApp';

const apiGet = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn(), baseUrl: '' },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  getAppType: () => 'booking',
  TENANT_SLUG: 'dr-smith',
  API_BASE: '',
}));
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, profile: { email: 'ada@example.com', type: 'user', firstName: 'Ada' }, logout: vi.fn() }),
}));

const { ClientShell } = await import('../../../../components/shell/ClientShell');
const { PortalHomePage } = await import('../PortalHomePage');

const SESSION = {
  id: '9', serviceTitle: 'Individual Therapy', startsAt: '2030-10-11T09:00:00.000Z', endsAt: '2030-10-11T09:50:00.000Z',
  status: 'CONFIRMED', priceKobo: '3000000', therapistName: 'Jane Smith', icalToken: 'tok', format: 'ONLINE',
};

function renderHome(payload: { upcoming: unknown[]; past: unknown[] }) {
  apiGet.mockImplementation((path: string) => {
    if (path === '/v1/consult/portal') return Promise.resolve({ clientName: 'Ada Obi', ...payload });
    if (path === '/v1/intake/mine/forms') return Promise.resolve([{ id: '1' }]);
    return Promise.resolve([]);
  });
  return renderWithApp(
    <Routes><Route path="/portal" element={<ClientShell><PortalHomePage /></ClientShell>} /></Routes>,
    { route: '/portal' },
  );
}

beforeEach(() => { apiGet.mockReset(); });
afterEach(cleanup);

describe('portal Home', () => {
  it('greets the client and shows the four tiles and the next session', async () => {
    renderHome({ upcoming: [SESSION], past: [] });
    expect(await screen.findByRole('heading', { name: 'Hello, Ada' })).toBeTruthy();
    for (const t of ['Next session', 'Upcoming sessions', 'To pay', 'Forms to do']) expect(screen.getByText(t)).toBeTruthy();
    expect(await screen.findByText(/Individual Therapy/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Book a session/ })[0].getAttribute('href')).toBe('/book');
  });

  it('offers the first booking when there are no sessions (Review Focus 2)', async () => {
    renderHome({ upcoming: [], past: [] });
    expect(await screen.findByText('You have no sessions booked yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Book your first session' }).getAttribute('href')).toBe('/book');
    expect(screen.queryByText(/undefined|NaN/)).toBeNull();
  });
});
