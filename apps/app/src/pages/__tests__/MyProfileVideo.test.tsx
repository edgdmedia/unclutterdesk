import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/** VID-01: a therapist chooses Unclutter Desk video or, with Google connected, Google Meet. */
const get = vi.fn();
const post = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } };
});
const { MyProfilePage } = await import('../practice/MyProfilePage');

function serve(profile: Record<string, unknown>) {
  get.mockImplementation((p: string) => {
    if (p === '/v1/tenant/locations') return Promise.resolve([]);
    if (p === '/v1/calendar/google/auth') return Promise.resolve({ url: 'https://accounts.google.com/o/oauth2/auth?x=1' });
    return Promise.resolve({ firstName: 'Ada', lastName: 'Eze', offersOnline: true, offersInPerson: false, locationIds: [], videoProvider: 'BUILT_IN', ...profile });
  });
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  post.mockResolvedValue({});
});
afterEach(cleanup);

describe('video sessions on my profile', () => {
  it('offers built-in video and Google Meet, with Meet unavailable until Google is connected', async () => {
    serve({ googleConnected: false });
    renderWithApp(<MyProfilePage />);
    const builtIn = (await screen.findByRole('radio', { name: /Unclutter Desk video/ })) as HTMLInputElement;
    const meet = screen.getByRole('radio', { name: /Google Meet/ }) as HTMLInputElement;
    expect(builtIn.checked).toBe(true);
    expect(meet.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Connect Google Calendar' })).toBeTruthy();
  });

  it('saves the choice', async () => {
    serve({ googleConnected: true, videoProvider: 'GOOGLE_MEET' });
    renderWithApp(<MyProfilePage />);
    fireEvent.click(await screen.findByRole('radio', { name: /Unclutter Desk video/ }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/consult/therapist/profile', expect.objectContaining({ videoProvider: 'BUILT_IN' })),
    );
  });

  it('lets a connected therapist pick Google Meet', async () => {
    serve({ googleConnected: true });
    renderWithApp(<MyProfilePage />);
    const meet = (await screen.findByRole('radio', { name: /Google Meet/ })) as HTMLInputElement;
    expect(meet.disabled).toBe(false);
    fireEvent.click(meet);
    expect(meet.checked).toBe(true);
  });
});
