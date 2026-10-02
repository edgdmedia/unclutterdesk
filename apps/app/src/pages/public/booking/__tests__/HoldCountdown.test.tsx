import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, renderWithApp, screen } from '../../../../test/renderWithApp';
import { HoldCountdown } from '../HoldCountdown';

describe('HoldCountdown (BKG-09)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('counts the hold down to the second, then says it ended', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T09:00:00Z'));
    renderWithApp(<HoldCountdown expiresAt="2026-10-06T09:34:05Z" />);
    expect(screen.getByRole('timer').textContent).toBe('34:05');
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByRole('timer').textContent).toBe('33:00');
    act(() => {
      vi.advanceTimersByTime(34 * 60_000);
    });
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.getByText(/your hold has ended/i)).toBeTruthy();
  });
});
