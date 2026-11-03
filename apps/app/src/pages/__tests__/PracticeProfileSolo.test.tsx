import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/* §6.17: a solo practice can use its owner's profile for its page. Only the network is stubbed. */
let brand: Record<string, unknown> = {};
const get = vi.fn(async (..._a: unknown[]) => brand);
const patch = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a) } };
});
const { PracticeProfilePage } = await import('../practice/settings/PracticeProfilePage');

afterEach(() => {
  cleanup();
  patch.mockClear();
});

describe('Practice profile for a solo therapist', () => {
  it('offers to use My profile, and shows what it fills in where a field is empty', async () => {
    brand = { name: 'Ada Practice', solo: true, useProfileForPractice: true, fromProfile: { tagline: 'Calm support', welcomeMessage: 'I help adults with anxiety.' } };
    renderWithApp(<PracticeProfilePage />);
    expect(await screen.findByText('Use my profile for my practice page')).toBeTruthy();
    expect(screen.getByPlaceholderText('From your profile: Calm support')).toBeTruthy();
    expect(screen.getByPlaceholderText('From your profile: I help adults with anxiety.')).toBeTruthy();
  });

  it('saves the switch, and never sends the read-only profile values back', async () => {
    brand = { name: 'Ada Practice', solo: true, useProfileForPractice: true, fromProfile: { tagline: 'Calm support' } };
    renderWithApp(<PracticeProfilePage />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Use my profile for my practice page' }));
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const sent = patch.mock.calls[0][1] as Record<string, unknown>;
    expect(sent.useProfileForPractice).toBe(false);
    expect(sent).not.toHaveProperty('fromProfile');
    expect(sent).not.toHaveProperty('solo');
  });

  it('does not offer it to a practice with a team', async () => {
    brand = { name: 'Calm Clinic', solo: false, useProfileForPractice: true, fromProfile: {} };
    renderWithApp(<PracticeProfilePage />);
    await screen.findByDisplayValue('Calm Clinic');
    expect(screen.queryByText('Use my profile for my practice page')).toBeNull();
  });
});
