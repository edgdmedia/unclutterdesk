import { describe, it, expect } from 'vitest';
import { ONLINE_HOLD_MINUTES, onlineHoldExpiry } from './online-hold';

describe('online payment hold', () => {
  const now = new Date('2026-10-06T09:00:00Z');

  it('holds the time for 35 minutes', () => {
    expect(ONLINE_HOLD_MINUTES).toBe(35);
    expect(onlineHoldExpiry(now, new Date('2026-10-06T12:00:00Z')).toISOString()).toBe('2026-10-06T09:35:00.000Z');
  });

  it('never holds past the start of the session', () => {
    expect(onlineHoldExpiry(now, new Date('2026-10-06T09:20:00Z')).toISOString()).toBe('2026-10-06T09:20:00.000Z');
  });
});
