import { describe, it, expect } from 'vitest';
import { slotsFromPattern, timesInHours } from './hours';

const never = () => false;
const time = (weekday: number, start: string, over: Partial<{ allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }> = {}) => ({
  weekday, start, allowsOnline: true, allowsInPerson: false, locationId: null, ...over,
});

describe('the weekly pattern', () => {
  it('lays out the session times that fit in working hours', () => {
    expect(timesInHours('09:00', '12:00', 50, 10)).toEqual(['09:00', '10:00', '11:00']);
    expect(timesInHours('09:00', '09:40', 50, 10)).toEqual([]);
  });

  it('uses Lagos time whatever the server time zone (Mon 09:00 WAT = 08:00Z)', () => {
    const slots = slotsFromPattern([time(0, '09:00')], { now: new Date('2026-10-04T12:00:00Z'), days: 7, sessionLengthMinutes: 50, isTaken: never });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(['2026-10-05T08:00:00.000Z']);
  });

  it('gives each time its own formats: online at 9, either at 10 (in person at Lekki)', () => {
    const slots = slotsFromPattern(
      [time(0, '09:00'), time(0, '10:00', { allowsInPerson: true, locationId: 4n })],
      { now: new Date('2026-10-04T12:00:00Z'), days: 7, sessionLengthMinutes: 50, isTaken: never },
    );
    expect(slots.map((s) => [s.startsAt.toISOString().slice(11, 16), s.allowsOnline, s.allowsInPerson, s.locationId])).toEqual([
      ['08:00', true, false, null],
      ['09:00', true, true, 4n],
    ]);
  });

  it('skips times already taken (a booking or a one-off change) and times in the past', () => {
    const now = new Date('2026-10-05T08:30:00Z');
    const taken = (s: Date) => s.toISOString() === '2026-10-05T09:00:00.000Z';
    const slots = slotsFromPattern([time(0, '09:00'), time(0, '10:00'), time(0, '11:00')], { now, days: 1, sessionLengthMinutes: 50, isTaken: taken });
    expect(slots.map((s) => s.startsAt.toISOString().slice(11, 16))).toEqual(['10:00']);
  });
});
