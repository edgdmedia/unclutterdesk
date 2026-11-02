/**
 * Booking limits and "today" are judged in Africa/Lagos time (spec §5.5).
 * The server's own timezone is not set (pm2 runs in UTC), so local-midnight
 * arithmetic would count the wrong month for the first hour of every month.
 * West Africa Time is UTC+1 all year, with no daylight saving. Per-practice
 * timezones are on the later list (§11).
 */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** The Lagos calendar date of `now`, as { year, month (0-11), day }. */
function lagosDate(now: Date) {
  const shifted = new Date(now.getTime() + LAGOS_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/** The instant the current month began in Lagos (midnight on the 1st, Lagos time). */
export function lagosMonthStart(now: Date = new Date()): Date {
  const { year, month } = lagosDate(now);
  return new Date(Date.UTC(year, month, 1) - LAGOS_OFFSET_MS);
}

/** The instant today began in Lagos. */
export function lagosDayStart(now: Date = new Date()): Date {
  const { year, month, day } = lagosDate(now);
  return new Date(Date.UTC(year, month, day) - LAGOS_OFFSET_MS);
}

/** The instant tomorrow begins in Lagos: anything before it is "today or earlier". */
export function lagosTomorrowStart(now: Date = new Date()): Date {
  return new Date(lagosDayStart(now).getTime() + 24 * 60 * 60 * 1000);
}

/** "12 November 2026", as a Lagos calendar date, for dates told to people. */
export function formatLagosDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
}
