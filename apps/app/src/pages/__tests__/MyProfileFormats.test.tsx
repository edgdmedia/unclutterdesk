import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

const get = vi.fn();
const post = vi.fn();
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } };
});
const { MyProfilePage } = await import('../practice/MyProfilePage');

beforeEach(() => {
  get.mockReset(); post.mockReset();
  get.mockImplementation((p: string) => {
    if (p === '/v1/tenant/locations') return Promise.resolve([{ id: '4', name: 'Lekki clinic', city: 'Lagos' }]);
    return Promise.resolve({ firstName: 'Ada', lastName: 'Eze', offersOnline: true, offersInPerson: false, locationIds: [] });
  });
  post.mockResolvedValue({});
});
afterEach(cleanup);

describe('sees clients on my profile', () => {
  it('turning on in person reveals the locations and saving sends both', async () => {
    renderWithApp(<MyProfilePage />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'In person' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Works at Lekki clinic' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/v1/consult/therapist/profile', expect.objectContaining({
        offersOnline: true, offersInPerson: true, locationIds: ['4'],
      })),
    );
  });
});
