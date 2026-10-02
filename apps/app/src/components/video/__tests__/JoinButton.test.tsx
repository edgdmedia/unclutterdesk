import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { joinState, joinWindow } from '@unclutterdesk/shared';
import { renderWithApp, screen, cleanup, act } from '../../../test/renderWithApp';
import { JoinButton } from '../JoinButton';

/**
 * VID-02: a Join button only works while the room is open (15 minutes before
 * the start to 60 minutes after the end), and says when it will open.
 * 08:00Z is 9:00 AM in Lagos.
 */
const STARTS = '2026-10-06T08:00:00Z';
const ENDS = '2026-10-06T08:50:00Z';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('joinState', () => {
  const at = (iso: string) => joinState(new Date(iso), new Date(STARTS), new Date(ENDS));
  it('is early until 15 minutes before, open until 60 minutes after the end, then over', () => {
    expect(at('2026-10-06T07:44:00Z')).toBe('early');
    expect(at('2026-10-06T07:45:00Z')).toBe('open');
    expect(at('2026-10-06T09:50:00Z')).toBe('open');
    expect(at('2026-10-06T09:51:00Z')).toBe('over');
  });
  it('gives the window itself', () => {
    expect(joinWindow(new Date(STARTS), new Date(ENDS))).toEqual({ opensAt: new Date('2026-10-06T07:45:00Z'), closesAt: new Date('2026-10-06T09:50:00Z') });
  });
});

describe('JoinButton', () => {
  function show() {
    renderWithApp(
      <Routes>
        <Route path="/" element={<JoinButton startsAt={STARTS} endsAt={ENDS} to="/portal/sessions/900/room" />} />
        <Route path="/portal/sessions/900/room" element={<p>The room</p>} />
      </Routes>,
    );
  }

  it('says when the room opens, and cannot be used before then', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-05T12:00:00Z'));
    show();
    const early = screen.getByRole('button', { name: 'Opens at 8:45 AM' });
    expect((early as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('link', { name: /join session/i })).toBeNull();
  });

  it('turns into Join session when the room opens, without a reload', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-06T07:44:30Z'));
    show();
    expect(screen.getByRole('button', { name: 'Opens at 8:45 AM' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('link', { name: /join session/i }).getAttribute('href')).toBe('/portal/sessions/900/room');
  });

  it('is gone once the session is over', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-06T10:00:00Z'));
    show();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
