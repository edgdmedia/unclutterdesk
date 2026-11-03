import { describe, expect, it } from 'vitest';
import { sessionStatus } from './sessionStatus';

const now = new Date('2026-11-04T10:00:00Z'); // 11:00 in Lagos
const at = (start: string, mins = 50) => [start, new Date(new Date(start).getTime() + mins * 60_000).toISOString()] as const;

describe('session status in plain words', () => {
  it('says whether a confirmed session is upcoming, today, in progress, or over and not closed', () => {
    expect(sessionStatus('CONFIRMED', ...at('2026-11-06T09:00:00Z'), now)).toEqual({ label: 'Upcoming', tone: 'ok' });
    expect(sessionStatus('CONFIRMED', ...at('2026-11-04T15:00:00Z'), now)).toEqual({ label: 'Today', tone: 'ok' });
    expect(sessionStatus('CONFIRMED', ...at('2026-11-04T09:30:00Z'), now)).toEqual({ label: 'In progress', tone: 'info' });
    expect(sessionStatus('CONFIRMED', ...at('2026-11-03T09:00:00Z'), now)).toEqual({ label: 'Not marked done', tone: 'warn' });
  });

  it('keeps what the stored status already decides', () => {
    expect(sessionStatus('COMPLETED', ...at('2026-11-03T09:00:00Z'), now).label).toBe('Completed');
    expect(sessionStatus('CANCELLED', ...at('2026-11-06T09:00:00Z'), now).label).toBe('Cancelled');
    expect(sessionStatus('PENDING_PAYMENT', ...at('2026-11-06T09:00:00Z'), now).label).toBe('Awaiting payment');
  });

  it('works out "today" in the practice time zone, not UTC', () => {
    // 23:30 UTC on the 4th is already the 5th in Lagos.
    expect(sessionStatus('CONFIRMED', ...at('2026-11-04T23:30:00Z'), now).label).toBe('Upcoming');
  });
});
