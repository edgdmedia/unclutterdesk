import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
const refreshProfile = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return {
    ...real,
    api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  };
});
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: '55', type: 'therapist', tenantId: '27', tenantSlug: 'smith-therapy', plan: 'PRO', firstName: 'Jane', lastName: 'Smith' },
    refreshProfile,
  }),
}));
const { DashboardPage } = await import('../practice/DashboardPage');

function deferred<T = void>() {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  refreshProfile.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url === '/v1/consult/therapist/profile') return { firstName: 'Jane', lastName: 'Smith', specialty: 'Psychologist', avatarUrl: null };
    if (url === '/v1/tenant/brand') return { customDomain: null, customDomainStatus: null };
    if (url === '/v1/tenant/notifications') return [];
    if (url === '/v1/consult/dashboard/summary') return {
      revenueThisMonthNaira: 0, monthlyRevenue: [], revenueChangePercent: null,
      scheduledSessionsCount: 0, totalClientsCount: 0, activeRosterCount: 1, upcomingSessions: [],
    };
    return {};
  });
});
afterEach(cleanup);

async function pickPhoto() {
  const input = await screen.findByLabelText('Upload profile photo');
  fireEvent.change(input, { target: { files: [new File([new Uint8Array([1, 2, 3])], 'me.png', { type: 'image/png' })] } });
}

describe('dashboard profile photo', () => {
  it('posts the chosen photo and shows it was saved', async () => {
    const save = deferred();
    post.mockReturnValue(save.promise);
    renderWithApp(<DashboardPage />);
    const input = await screen.findByLabelText('Upload profile photo');
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([1, 2, 3])], 'me.png', { type: 'image/png' })] } });
    await waitFor(() =>
      expect(screen.queryAllByRole('status').some((el) => el.textContent?.includes('Saving…'))).toBe(true),
    );
    await act(async () => {
      save.resolve();
    });
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/consult/therapist/profile/avatar', { avatarUrl: expect.stringMatching(/^data:image\//) }),
    );
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    // GEN-02: once saved, the card retires; the photo lives on in the menu.
    await waitFor(() => expect(screen.queryByLabelText('Upload profile photo')).toBeNull());
  });

  it('shows the server’s message when the save is refused', async () => {
    post.mockRejectedValue(new Error('That photo is too large. Choose a smaller image (under about 60 KB).'));
    renderWithApp(<DashboardPage />);
    await pickPhoto();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch('That photo is too large'));
  });

  it('no longer promises a 2 MB limit', async () => {
    renderWithApp(<DashboardPage />);
    await screen.findByLabelText('Upload profile photo');
    expect(document.body.textContent).not.toMatch(/2 MB/);
  });

  // GEN-02: setup prompts that stay after the job is done are noise.
  it('does not ask for a photo that is already saved', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/v1/consult/therapist/profile') return { firstName: 'Jane', lastName: 'Smith', specialty: 'Psychologist', avatarUrl: 'https://cdn/x.png' };
      if (url === '/v1/tenant/brand') return { customDomain: null, customDomainStatus: null, logoUrl: 'https://cdn/logo.png' };
      if (url === '/v1/tenant/notifications') return [];
      if (url === '/v1/consult/dashboard/summary') return {
        revenueThisMonthNaira: 0, monthlyRevenue: [], revenueChangePercent: null,
        scheduledSessionsCount: 0, totalClientsCount: 0, activeRosterCount: 1, upcomingSessions: [],
      };
      return {};
    });
    renderWithApp(<DashboardPage />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/v1/consult/dashboard/summary'));
    expect(screen.queryByLabelText('Upload profile photo')).toBeNull();
    expect(screen.queryByText('PRACTICE BRANDING')).toBeNull();
    expect(screen.queryByText('Colors & Custom Domain')).toBeNull();
  });

  it('still asks for branding while no logo exists', async () => {
    renderWithApp(<DashboardPage />);
    expect(await screen.findByText('Colors & Custom Domain')).toBeTruthy();
  });
});
