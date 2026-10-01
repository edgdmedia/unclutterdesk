import { describe, expect, it } from 'vitest';
import { dayKeyWAT, formatOf, formatsOffered, nextDayWithSlots, slotsForService, slotsOnDay, timeLabelWAT, weekDays, weekLabel } from '../bookingSlots';

const slot = (id: string, startsAt: string, channel = 'VIDEO', serviceId: string | null = null) =>
  ({ id, serviceId, therapistName: 'Sarah Smith', startsAt, endsAt: startsAt, channel });

describe('booking slots', () => {
  it('groups by the day in Lagos, not the browser', () => {
    // 22:30 UTC is 23:30 in Lagos on the same day; 23:30 UTC is 00:30 the next day.
    expect(dayKeyWAT('2026-10-06T22:30:00Z')).toBe('2026-10-06');
    expect(dayKeyWAT('2026-10-06T23:30:00Z')).toBe('2026-10-07');
    expect(timeLabelWAT('2026-10-06T10:30:00Z')).toBe('11:30 AM');
  });

  it('pages four weeks of seven days from today, labelled for the header', () => {
    const today = new Date('2026-10-01T08:00:00Z');
    expect(weekDays(today, 0)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
    expect(weekDays(today, 3)[6]).toBe('2026-10-28');
    expect(weekLabel(weekDays(today, 0))).toBe('1 Oct – 7 Oct');
  });

  it('reads the format the practice set, treating older slots as online', () => {
    expect(formatOf('IN_PERSON')).toBe('In person');
    expect(formatOf('VIDEO')).toBe('Online');
    expect(formatOf('')).toBe('Online');
  });

  it("keeps open slots and the service's own, filters by day and format", () => {
    const all = [slot('a', '2026-10-06T08:00:00Z'), slot('b', '2026-10-06T12:00:00Z', 'IN_PERSON'), slot('c', '2026-10-06T13:00:00Z', 'VIDEO', 'other')];
    const forS1 = slotsForService(all, 's1');
    expect(forS1.map((s) => s.id)).toEqual(['a', 'b']);
    expect(slotsOnDay(forS1, '2026-10-06', 'In person').map((s) => s.id)).toEqual(['b']);
    expect(slotsOnDay(forS1, '2026-10-06', 'All').map((s) => s.id)).toEqual(['a', 'b']);
    expect(formatsOffered(forS1)).toEqual(['Online', 'In person']);
  });

  it('finds the next day with times', () => {
    const all = [slot('a', '2026-10-13T09:00:00Z')];
    expect(nextDayWithSlots(all, '2026-10-07')).toBe('2026-10-13');
    expect(nextDayWithSlots(all, '2026-10-13')).toBeNull();
  });
});
