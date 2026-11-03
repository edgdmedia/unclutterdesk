import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, renderWithApp, screen, waitFor } from '../../test/renderWithApp';

/* VID-02: each practice chooses how early its rooms open. Only the network is stubbed. */
const patch = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/apiClient')>();
  return { ...real, api: { ...real.api, patch: (...a: unknown[]) => patch(...a) } };
});
let auth: any = null;
vi.mock('../../context/AuthContext', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../context/AuthContext')>();
  return { ...real, useOptionalAuth: () => auth };
});
const { JoinButton } = await import('../video/JoinButton');
const { VideoRoomOpensSetting } = await import('../settings/VideoRoomOpensSetting');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  patch.mockClear();
});

const session = (minsFromNow: number) => {
  const start = new Date(Date.now() + minsFromNow * 60_000);
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 50 * 60_000).toISOString() };
};

describe('the Join button follows the practice setting', () => {
  it('is open 8 minutes before when the practice opens rooms 10 minutes early', () => {
    auth = { profile: { joinOpensMinutesBefore: 10 } };
    renderWithApp(<JoinButton {...session(8)} to="/session/1" />);
    expect(screen.getByRole('link', { name: /Join session/ })).toBeTruthy();
  });

  it('waits until the start when the practice opens rooms at the start time', () => {
    auth = { profile: { joinOpensMinutesBefore: 0 } };
    renderWithApp(<JoinButton {...session(8)} to="/session/1" />);
    expect(screen.getByRole('button', { name: /Opens at/ })).toBeTruthy();
  });

  it("uses the server's opening time when the page has it", () => {
    auth = { profile: { joinOpensMinutesBefore: 15 } };
    const s = session(8);
    renderWithApp(<JoinButton {...s} opensAt={s.startsAt} to="/session/1" />);
    expect(screen.getByRole('button', { name: /Opens at/ })).toBeTruthy();
  });
});

describe('the setting', () => {
  it('is shown only to people who manage the practice, and saves straight away', async () => {
    auth = { profile: { permissions: [], joinOpensMinutesBefore: 10 }, refreshProfile: vi.fn() };
    const { unmount } = renderWithApp(<VideoRoomOpensSetting />);
    expect(screen.queryByLabelText(/Video room opens/)).toBeNull();
    unmount();
    auth = { profile: { permissions: ['practice.admin'], joinOpensMinutesBefore: 10 }, refreshProfile: vi.fn(async () => undefined) };
    renderWithApp(<VideoRoomOpensSetting />);
    fireEvent.change(screen.getByLabelText(/Video room opens/), { target: { value: '5' } });
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/v1/tenant/brand', { joinOpensMinutesBefore: 5 }));
    expect(auth.refreshProfile).toHaveBeenCalled();
  });
});
