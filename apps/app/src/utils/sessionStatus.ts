import type { StatusTone } from '@unclutterdesk/ui';

/**
 * What a session's status means right now, in plain words. The stored status
 * says what was agreed (confirmed, paid, cancelled); the time says whether it
 * is still to come, under way, or over. Used by the dashboard, the sessions
 * list, the session page and the client page so they always agree.
 */
export function sessionStatus(status: string | null | undefined, startsAt: string | Date, endsAt: string | Date, now: Date = new Date(), timezone = 'Africa/Lagos'): { label: string; tone: StatusTone } {
  const s = (status ?? '').toUpperCase();
  if (s === 'CANCELLED' || s === 'CANCELED') return { label: 'Cancelled', tone: 'danger' };
  if (s === 'COMPLETED') return { label: 'Completed', tone: 'muted' };
  if (s === 'NO_SHOW') return { label: 'No-show', tone: 'danger' };
  if (s === 'PENDING_PAYMENT' || s === 'PENDING') return { label: 'Awaiting payment', tone: 'warn' };
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const t = now.getTime();
  if (t >= end) return { label: 'Not marked done', tone: 'warn' };
  if (t >= start) return { label: 'In progress', tone: 'info' };
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  if (day(new Date(start)) === day(now)) return { label: 'Today', tone: 'ok' };
  return { label: 'Upcoming', tone: 'ok' };
}
