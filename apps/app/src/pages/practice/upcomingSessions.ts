import type { CalendarEvent } from '../../App';

/**
 * The dashboard's Upcoming list: sessions that haven't ended yet, soonest
 * first. Cancelled sessions and admin blocks are left out; a session whose
 * time has passed is not "upcoming", whether or not it was marked done.
 */
export const UPCOMING_LIMIT = 5;

const LEFT_OUT = new Set(['CANCELLED', 'CANCELED', 'NO_SHOW']);

export function upcomingSessions(events: CalendarEvent[], now: Date, limit = UPCOMING_LIMIT): { shown: CalendarEvent[]; more: number } {
  const all = events
    .filter((e) => e.category !== 'admin' && !LEFT_OUT.has((e.status ?? '').toUpperCase()) && new Date(e.endsAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return { shown: all.slice(0, limit), more: Math.max(0, all.length - limit) };
}

/** What a session's badge says right now. */
export function sessionBadge(e: CalendarEvent, now: Date): { label: string; tone: 'live' | 'ok' | 'wait' } {
  const status = (e.status ?? '').toUpperCase();
  if (status === 'PENDING_PAYMENT' || status === 'PENDING') return { label: 'Awaiting payment', tone: 'wait' };
  const start = new Date(e.startsAt).getTime();
  const end = new Date(e.endsAt).getTime();
  if (now.getTime() >= start && now.getTime() < end) return { label: 'In progress', tone: 'live' };
  return { label: 'Confirmed', tone: 'ok' };
}
