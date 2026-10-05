import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useSyncExternalStore } from 'react';
import { act } from 'react';
import { renderWithApp, screen, waitFor, cleanup } from '../../../../test/renderWithApp';

/**
 * A portal that learns the person is signed out must stop showing their
 * sessions. The shell now guards at the frame: the children never render,
 * so nothing of theirs is left on screen beside the sign-in card.
 */
const apiGet = vi.fn();

vi.mock('../../../../utils/apiClient', () => ({
  api: { get: (...args: unknown[]) => apiGet(...args), post: vi.fn(), patch: vi.fn(), baseUrl: '' },
  getBookingUrl: (slug: string) => `https://${slug}.unclutterdesk.com`,
  getAppType: () => 'booking',
  TENANT_SLUG: 'dr-smith',
  API_BASE: '',
}));

let signedIn = true;
const listeners = new Set<() => void>();
function setSignedIn(value: boolean) {
  signedIn = value;
  listeners.forEach((l) => l());
}
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => {
    const on = useSyncExternalStore(
      (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      () => signedIn,
    );
    return on
      ? { isAuthenticated: true, profile: { email: 'ada@example.com', type: 'user', firstName: 'Ada' }, logout: vi.fn() }
      : { isAuthenticated: false, profile: null, logout: vi.fn() };
  },
}));

const { ClientShell } = await import('../../../../components/shell/ClientShell');
const { PortalHomePage } = await import('../PortalHomePage');

const SESSION = {
  id: '9',
  serviceTitle: 'Individual Therapy',
  therapistName: 'Dr Bello',
  startsAt: '2030-10-02T13:00:00Z',
  endsAt: '2030-10-02T14:00:00Z',
  status: 'CONFIRMED',
  format: 'ONLINE',
};

apiGet.mockImplementation((path: string) => {
  if (path === '/v1/consult/portal') return Promise.resolve({ clientName: 'Ada Obi', upcoming: [SESSION], past: [] });
  return Promise.resolve([]);
});

afterEach(() => {
  cleanup();
  signedIn = true;
});

describe('the portal once the person is signed out', () => {
  it('hides their name and sessions and shows only the sign-in card', async () => {
    renderWithApp(<ClientShell><PortalHomePage /></ClientShell>);
    await waitFor(() => expect(screen.getByText('Hello, Ada')).toBeTruthy());

    act(() => setSignedIn(false));

    expect(screen.getByText('Sign in to see your sessions')).toBeTruthy();
    expect(screen.queryByText('Hello, Ada')).toBeNull();
    expect(screen.queryAllByText(/Individual Therapy/)).toHaveLength(0);
    expect(screen.queryByText('Join session')).toBeNull();
  });
});
