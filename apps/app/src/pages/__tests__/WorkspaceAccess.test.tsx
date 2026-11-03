import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { homePathFor } from '../../utils/homePath';

/*
 * A client who opens a therapist-workspace link must land in their portal,
 * not in a workspace whose every request the API refuses. The whole app is
 * rendered; only the network is stubbed.
 */
let me: Record<string, unknown> | null = null;
const get = vi.fn(async (path: string) => {
  if (path === '/v1/auth/status') {
    if (!me) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return me;
  }
  return [];
});
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (p: string) => get(p), post: vi.fn(async () => ({})), patch: vi.fn(), put: vi.fn() } };
});
const { App } = await import('../../App');

const profile = (type: string) => ({ id: '1', userId: '1', tenantId: '3', tenantSlug: 'calm', type, role: type === 'user' ? 'CLIENT' : 'OWNER', firstName: 'Ada', lastName: 'O', email: 'ada@example.test', permissions: [] });

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

describe('who may open the practice workspace', () => {
  it('sends each kind of account to its own home', () => {
    expect(homePathFor({ type: 'user' })).toBe('/portal');
    expect(homePathFor({ type: 'platform_admin' })).toBe('/admin');
    expect(homePathFor({ type: 'therapist' })).toBe('/dashboard');
    expect(homePathFor({ type: 'admin' })).toBe('/dashboard');
  });

  it('moves a signed-in client from a workspace page to the portal', async () => {
    me = profile('user');
    window.history.pushState({}, '', '/dashboard/schedule');
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe('/portal'));
  });

  it('lets practice staff stay in the workspace', async () => {
    me = profile('therapist');
    window.history.pushState({}, '', '/dashboard/schedule');
    render(<App />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/v1/auth/status'));
    await new Promise((r) => setTimeout(r, 50));
    expect(window.location.pathname).toBe('/dashboard/schedule');
  });
});
