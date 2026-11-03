import type { CalendarEvent } from '../../App';
import { sessionStatus } from '../../utils/sessionStatus';

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

/** What a session's badge says right now: the same words as everywhere else (utils/sessionStatus). */
export function sessionBadge(e: CalendarEvent, now: Date, timezone?: string): { label: string; tone: 'live' | 'ok' | 'wait' } {
  const st = sessionStatus(e.status, e.startsAt, e.endsAt, now, timezone);
  return { label: st.label, tone: st.tone === 'info' ? 'live' : st.tone === 'warn' || st.tone === 'danger' ? 'wait' : 'ok' };
}
