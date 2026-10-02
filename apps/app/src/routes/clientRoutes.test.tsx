import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { renderWithApp, screen } from '../test/renderWithApp';

const get = vi.fn();
vi.mock('../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a) } };
});
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ profile: null, isAuthenticated: false, isLoading: false, refreshProfile: vi.fn(), logout: vi.fn(), login: vi.fn() }),
}));
import { CLIENT_PORTAL_ROUTES } from './clientRoutes';

/**
 * POR-01: clients arrive at the practice's own link — the confirmation email's
 * "Go to my bookings" and the portal button. These routes must render on the
 * practice host, not only on the app host, so both trees share this fragment.
 */
function at(path: string) {
  return renderWithApp(<Routes>{CLIENT_PORTAL_ROUTES}</Routes>, { route: path });
}

describe('client routes on the practice host', () => {
  it('serves the client portal', async () => {
    get.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.includes('consult/portal')) return Promise.resolve({ clientName: '', upcoming: [], past: [] });
      if (typeof p === 'string' && p.includes('intake/public/forms')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    at('/portal');
    expect(await screen.findByText(/sign in to see your sessions/i)).toBeTruthy();
  });

  it('serves the client login', async () => {
    get.mockResolvedValue({});
    at('/login');
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeTruthy();
  });
});
