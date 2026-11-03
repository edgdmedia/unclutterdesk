import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../../App';
import { sessionBadge, upcomingSessions } from './upcomingSessions';

const now = new Date('2026-11-04T10:00:00Z');
const ev = (id: string, start: string, mins = 50, over: Partial<CalendarEvent> = {}): CalendarEvent => {
  const s = new Date(start);
  return { id, title: `Client ${id}`, type: 'Individual Therapy', startsAt: s.toISOString(), endsAt: new Date(s.getTime() + mins * 60_000).toISOString(), category: 'individual', status: 'CONFIRMED', ...over };
};

describe('the dashboard Upcoming list', () => {
  it('shows only sessions that have not ended, soonest first, and counts the rest', () => {
    const list = [
      ev('past-not-done', '2026-11-03T09:00:00Z'),
      ev('later', '2026-11-06T09:00:00Z'),
      ev('now', '2026-11-04T09:30:00Z'),
      ev('cancelled', '2026-11-05T09:00:00Z', 50, { status: 'CANCELLED' }),
      ev('admin', '2026-11-05T11:00:00Z', 50, { category: 'admin' }),
      ...['a', 'b', 'c', 'd'].map((x, i) => ev(x, `2026-11-${10 + i}T09:00:00Z`)),
    ];
    const { shown, more } = upcomingSessions(list, now);
    expect(shown.map((e) => e.id)).toEqual(['now', 'later', 'a', 'b', 'c']);
    expect(more).toBe(1);
  });

  it('labels each session by what is true now, not a fixed word', () => {
    expect(sessionBadge(ev('x', '2026-11-04T09:30:00Z'), now).label).toBe('In progress');
    expect(sessionBadge(ev('x', '2026-11-04T15:00:00Z'), now).label).toBe('Today');
    expect(sessionBadge(ev('x', '2026-11-05T09:00:00Z'), now).label).toBe('Upcoming');
    expect(sessionBadge(ev('x', '2026-11-05T09:00:00Z', 50, { status: 'PENDING_PAYMENT' }), now).label).toBe('Awaiting payment');
  });
});
