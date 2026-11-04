import { describe, expect, it } from 'vitest';
import { serviceColour, servicesInView, visibleDays, visibleHours } from './scheduleView';

const local = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo, d, h, mi).toISOString();

describe('what the Schedule shows', () => {
  it('spans the working day: at least 8 AM to 6 PM, wider for early or late weekly times and sessions', () => {
    expect(visibleHours([], [])).toEqual({ startHour: 8, endHour: 18 });
    expect(visibleHours([], [{ weekday: 0, start: '07:00' }, { weekday: 2, start: '19:30' }], 50)).toEqual({ startHour: 7, endHour: 21 });
    expect(visibleHours([{ startsAt: local(2026, 10, 5, 20), endsAt: local(2026, 10, 5, 20, 50), type: 'x' }], [])).toEqual({ startHour: 8, endHour: 21 });
  });

  it('shows the weekend only when it is worked', () => {
    const monday = new Date(2026, 10, 2);
    expect(visibleDays(monday, [], [])).toHaveLength(5);
    expect(visibleDays(monday, [], [{ weekday: 5, start: '10:00' }]).map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5, 6]);
    expect(visibleDays(monday, [{ startsAt: local(2026, 10, 8, 10), endsAt: local(2026, 10, 8, 11), type: 'x' }], []).map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('gives each service one colour and lists the services in view', () => {
    expect(serviceColour('Individual Therapy')).toBe(serviceColour('individual therapy '));
    expect(servicesInView([{ startsAt: '', endsAt: '', type: 'Consultation' }, { startsAt: '', endsAt: '', type: 'Individual Therapy' }, { startsAt: '', endsAt: '', type: 'Consultation' }])).toEqual(['Consultation', 'Individual Therapy']);
  });
});
