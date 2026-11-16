import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/* §6.17: a solo practice can use its owner's profile for its page. Only the network is stubbed. */
let brand: Record<string, unknown> = {};
let own: Record<string, unknown> | null = null;
const get = vi.fn(async (...a: unknown[]) => (a[0] === '/v1/practitioner-profile/me' ? own : brand));
const patch = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({}));
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a) } };
});
const { PracticeProfilePage } = await import('../practice/settings/PracticeProfilePage');

afterEach(() => {
  cleanup();
  patch.mockReset().mockImplementation(async () => ({}));
  own = null;
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

/* §6.16: a solo practice's address shows the owner's profile at / unless they choose the practice page. */
describe('What a solo practice address shows', () => {
  const SWITCH = { name: 'Show my profile at my practice address' };

  it('is on by default, and switching it off saves the practice page at once', async () => {
    brand = { name: 'Ada Practice', solo: true, homePage: null };
    own = { status: 'PUBLISHED', handle: 'ada-obi', themeKey: 'calm', brandColor: null };
    renderWithApp(<PracticeProfilePage />);
    const toggle = await screen.findByRole('switch', SWITCH);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/tenant/home-page', { homePage: 'PRACTICE' }));
    expect(screen.getByRole('switch', SWITCH).getAttribute('aria-checked')).toBe('false');
  });

  it('switches back to the profile', async () => {
    brand = { name: 'Ada Practice', solo: true, homePage: 'PRACTICE' };
    own = { status: 'PUBLISHED', handle: 'ada-obi' };
    renderWithApp(<PracticeProfilePage />);
    const toggle = await screen.findByRole('switch', SWITCH);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/tenant/home-page', { homePage: 'PROFILE' }));
  });

  it('says it starts once the profile is published', async () => {
    brand = { name: 'Ada Practice', solo: true, homePage: null };
    own = { status: 'DRAFT', handle: 'ada-obi' };
    renderWithApp(<PracticeProfilePage />);
    expect(await screen.findByText(/once your profile is published/i)).toBeTruthy();
  });

  it('puts the switch back and says why when the change is refused', async () => {
    brand = { name: 'Ada Practice', solo: true, homePage: null };
    own = { status: 'PUBLISHED', handle: 'ada-obi' };
    patch.mockRejectedValueOnce(new Error('Only the practice owner can do that'));
    renderWithApp(<PracticeProfilePage />);
    fireEvent.click(await screen.findByRole('switch', SWITCH));
    expect(await screen.findByText('Only the practice owner can do that')).toBeTruthy();
    expect(screen.getByRole('switch', SWITCH).getAttribute('aria-checked')).toBe('true');
  });

  it('is not offered to a practice with a team', async () => {
    brand = { name: 'Calm Clinic', solo: false, homePage: null };
    renderWithApp(<PracticeProfilePage />);
    await screen.findByDisplayValue('Calm Clinic');
    expect(screen.queryByRole('switch', SWITCH)).toBeNull();
  });

  it('is never sent with the rest of the practice profile', async () => {
    brand = { name: 'Ada Practice', solo: true, homePage: 'PRACTICE' };
    renderWithApp(<PracticeProfilePage />);
    await screen.findByRole('switch', SWITCH);
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][1]).not.toHaveProperty('homePage');
  });
});
