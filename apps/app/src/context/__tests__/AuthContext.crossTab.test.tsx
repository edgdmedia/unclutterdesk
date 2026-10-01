import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

const get = vi.fn();
vi.mock('../../utils/apiClient', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: vi.fn() },
  setSessionExpiredHandler: vi.fn(),
}));
const { AuthProvider, useAuth } = await import('../AuthContext');

function Who() {
  const { profile } = useAuth();
  return <p>{profile ? `signed in as ${profile.email}` : 'signed out'}</p>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('AuthProvider across tabs', () => {
  it('follows a sign-in made in another tab', async () => {
    get.mockResolvedValue({ id: '55', email: 'owner@calm.ng', type: 'therapist', status: 'active', tenantId: '27' });
    render(<AuthProvider><Who /></AuthProvider>);
    expect(await screen.findByText('signed in as owner@calm.ng')).toBeTruthy();

    // Another tab signs in as the platform admin: it rewrites the cached profile.
    const admin = { __v: 2, profile: { id: '3', email: 'admin@unclutterdesk.com', type: 'platform_admin', status: 'active' } };
    act(() => {
      localStorage.setItem('unclutter_profile', JSON.stringify(admin));
      window.dispatchEvent(new StorageEvent('storage', { key: 'unclutter_profile', newValue: JSON.stringify(admin) }));
    });
    await waitFor(() => expect(screen.getByText('signed in as admin@unclutterdesk.com')).toBeTruthy());

    // ...and signs out.
    act(() => {
      localStorage.removeItem('unclutter_profile');
      window.dispatchEvent(new StorageEvent('storage', { key: 'unclutter_profile', newValue: null }));
    });
    await waitFor(() => expect(screen.getByText('signed out')).toBeTruthy());
  });
});
