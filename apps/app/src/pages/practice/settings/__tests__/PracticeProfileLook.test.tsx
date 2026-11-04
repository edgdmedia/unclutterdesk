import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../../../test/renderWithApp';

/* Task 8: the Practice profile page carries the look — read-only from the owner's profile when solo, and the same palette picker for a team. Only the network is faked. */

let brand: Record<string, unknown> = {};
let own: Record<string, unknown> | null = null;
// `vi.fn()` keeps a rest-arg signature, so spreading into it inside the mock
// module below typechecks; a narrowly typed implementation would not.
const get = vi.fn();
const patch = vi.fn();
vi.mock('../../../../utils/apiClient', async (importOriginal) => {
  await importOriginal();
  return { api: { get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a) } };
});
const { PracticeProfilePage } = await import('../PracticeProfilePage');

beforeEach(() => {
  get.mockImplementation((path: string) => Promise.resolve(path === '/v1/practitioner-profile/me' ? own : brand));
  patch.mockReset();
  patch.mockResolvedValue({});
});

afterEach(cleanup);

describe('the practice look', () => {
  it('a solo practice shows the profile’s palette read-only, with a way to change it there', async () => {
    brand = { name: 'Ada Practice', solo: true, useProfileForPractice: true, primaryColor: '#0F3A53' };
    own = { themeKey: 'warm', brandColor: null };
    renderWithApp(<PracticeProfilePage />);

    // The load decides read-only; wait for it rather than for a radio that is
    // also there while the page is still editable.
    expect(await screen.findByRole('link', { name: 'Change in your profile' })).toBeTruthy();
    const warm = screen.getByRole('radio', { name: /Warm/ });
    expect(warm.getAttribute('aria-checked')).toBe('true');
    expect(warm.getAttribute('aria-disabled')).toBe('true');
    // Nothing to type: the colour is changed in My profile.
    expect(screen.queryByLabelText('Brand colour hex')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Custom' })).toBeNull();

    fireEvent.click(warm);
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect((patch.mock.calls[0][1] as Record<string, unknown>).primaryColor).toBe('#0F3A53');
  });

  it('a solo practice shows its custom colour read-only too', async () => {
    brand = { name: 'Ada Practice', solo: true, useProfileForPractice: true };
    own = { themeKey: 'custom', brandColor: '#123456' };
    renderWithApp(<PracticeProfilePage />);

    expect(await screen.findByRole('link', { name: 'Change in your profile' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Custom' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Custom' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByLabelText('Brand colour hex')).toBeNull();
  });

  it('a team practice picks a palette for the practice brand and saves its accent', async () => {
    brand = { name: 'Calm Clinic', solo: false, primaryColor: '#2A56A8' };
    own = null;
    renderWithApp(<PracticeProfilePage />);

    // #2A56A8 is Calm's accent, so Calm is the starting choice once loaded.
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Calm/ }).getAttribute('aria-checked')).toBe('true'),
    );
    const warm = screen.getByRole('radio', { name: /Warm/ });
    fireEvent.click(warm);
    expect(warm.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect((patch.mock.calls[0][1] as Record<string, unknown>).primaryColor).toBe('#8A5A3C');
  });

  it('a team practice can set a custom brand colour', async () => {
    brand = { name: 'Calm Clinic', solo: false, primaryColor: '#2A56A8' };
    own = null;
    renderWithApp(<PracticeProfilePage />);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Calm/ }).getAttribute('aria-checked')).toBe('true'),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Brand colour hex'), { target: { value: '#123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save colour' }));
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect((patch.mock.calls[0][1] as Record<string, unknown>).primaryColor).toBe('#123456');
  });

  it('a solo practice that stopped using its profile gets the picker back', async () => {
    brand = { name: 'Ada Practice', solo: true, useProfileForPractice: false, primaryColor: '#2A56A8' };
    own = { themeKey: 'warm', brandColor: null };
    renderWithApp(<PracticeProfilePage />);

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Calm/ }).getAttribute('aria-checked')).toBe('true'),
    );
    expect(screen.getByRole('radio', { name: /Warm/ }).getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Change in your profile' })).toBeNull();
  });
});