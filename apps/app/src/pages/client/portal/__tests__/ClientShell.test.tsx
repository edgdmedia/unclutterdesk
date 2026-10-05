import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { useSyncExternalStore } from 'react';
import { act } from 'react';
import { Route, Routes } from 'react-router-dom';
import { renderWithApp, screen, waitFor, cleanup } from '../../../../test/renderWithApp';

const apiGet = vi.fn();
vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), patch: vi.fn(), baseUrl: '' },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  getAppType: () => 'booking',
  TENANT_SLUG: 'dr-smith',
  API_BASE: '',
}));

let signedIn = true;
const listeners = new Set<() => void>();
const setSignedIn = (v: boolean) => { signedIn = v; listeners.forEach((l) => l()); };
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => {
    const on = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => signedIn);
    return on
      ? { isAuthenticated: true, profile: { email: 'ada@example.com', type: 'user', firstName: 'Ada' }, logout: vi.fn() }
      : { isAuthenticated: false, profile: null, logout: vi.fn() };
  },
}));

const { ClientShell } = await import('../../../../components/shell/ClientShell');
const { usePortalData } = await import('../PortalDataContext');

function Probe() {
  const { portal } = usePortalData();
  return <p>{portal.upcoming.length} upcoming</p>;
}

function mockRoutes() {
  apiGet.mockImplementation((path: string) => {
    if (path === '/v1/consult/portal') return Promise.resolve({ clientName: 'Ada Obi', upcoming: [{ id: '9' }], past: [] });
    if (path === '/v1/intake/mine/forms') return Promise.resolve([{ id: '1' }, { id: '2' }]);
    return Promise.resolve([]);
  });
}

beforeEach(() => { apiGet.mockReset(); mockRoutes(); });
afterEach(() => { cleanup(); signedIn = true; });

const renderAt = (path: string) =>
  renderWithApp(
    <Routes><Route path="/portal/*" element={<ClientShell><Probe /></ClientShell>} /></Routes>,
    { route: path },
  );

describe('ClientShell', () => {
  it('shows the five menu items, the bell and the shared data', async () => {
    renderAt('/portal');
    for (const label of ['Home', 'Sessions', 'Forms & assessments', 'Payments', 'My details']) {
      expect((await screen.findAllByRole('link', { name: new RegExp(label) })).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('button', { name: /Notifications/ })).toBeTruthy();
    expect(await screen.findByText('1 upcoming')).toBeTruthy();
  });

  it('loads the portal once, not once per page', async () => {
    renderAt('/portal/payments');
    await screen.findByText('1 upcoming');
    expect(apiGet.mock.calls.filter(([p]) => p === '/v1/consult/portal')).toHaveLength(1);
  });

  it('drops the frame and the data together when the person is signed out (Review Focus 1)', async () => {
    renderAt('/portal/payments');
    await screen.findByText('1 upcoming');
    act(() => setSignedIn(false));
    await waitFor(() => expect(screen.queryByText('1 upcoming')).toBeNull());
    expect(screen.queryByRole('link', { name: /My details/ })).toBeNull();
    expect(screen.getByText('Sign in to see your sessions')).toBeTruthy();
  });
});
