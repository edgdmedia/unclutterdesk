import { describe, expect, it } from 'vitest';
import { sessionStatus } from './sessionStatus';

const now = new Date('2026-11-04T10:00:00Z'); // 11:00 in Lagos
const row = (status: string, start: string, extra: { unscheduledAt?: string } = {}) => ({
  status,
  startsAt: start,
  endsAt: new Date(new Date(start).getTime() + 50 * 60_000).toISOString(),
  ...extra,
});

describe('session status in plain words', () => {
  it('says whether a confirmed session is upcoming, today, in progress, or over and not closed', () => {
    expect(sessionStatus(row('CONFIRMED', '2026-11-06T09:00:00Z'), now)).toEqual({ label: 'Upcoming', tone: 'ok' });
    expect(sessionStatus(row('CONFIRMED', '2026-11-04T15:00:00Z'), now)).toEqual({ label: 'Today', tone: 'ok' });
    expect(sessionStatus(row('CONFIRMED', '2026-11-04T09:30:00Z'), now)).toEqual({ label: 'In progress', tone: 'info' });
    expect(sessionStatus(row('CONFIRMED', '2026-11-03T09:00:00Z'), now)).toEqual({ label: 'Not marked done', tone: 'warn' });
  });

  it('keeps what the stored status already decides', () => {
    expect(sessionStatus(row('COMPLETED', '2026-11-03T09:00:00Z'), now).label).toBe('Completed');
    expect(sessionStatus(row('CANCELLED', '2026-11-06T09:00:00Z'), now).label).toBe('Cancelled');
    expect(sessionStatus(row('PENDING_PAYMENT', '2026-11-06T09:00:00Z'), now).label).toBe('Awaiting payment');
  });

  // "Client chooses later" cancels the booking in the records, but nothing was called off.
  it('says a session left for the client to choose a time is open, not cancelled', () => {
    expect(sessionStatus(row('CANCELLED', '2026-11-06T09:00:00Z', { unscheduledAt: '2026-11-04T08:00:00Z' }), now)).toEqual({ label: 'Open', tone: 'info' });
    expect(sessionStatus(row('CANCELLED', '2026-11-03T09:00:00Z', { unscheduledAt: '2026-11-02T08:00:00Z' }), now).label).toBe('Open');
  });

  it('works out "today" in the practice time zone, not UTC', () => {
    // 23:30 UTC on the 4th is already the 5th in Lagos.
    expect(sessionStatus(row('CONFIRMED', '2026-11-04T23:30:00Z'), now).label).toBe('Upcoming');
  });
});
